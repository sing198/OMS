package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func mockDB(t *testing.T) (*gorm.DB, sqlmock.Sqlmock) {
	t.Helper()
	conn, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(postgres.New(postgres.Config{Conn: conn}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Error(err)
		}
		conn.Close()
	})
	return db, mock
}

func orderRouter(db *gorm.DB) *gin.Engine {
	DB = db
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/orders", func(c *gin.Context) { c.Set("user_id", 1); c.Next() }, createOrderHandler)
	return r
}

func TestInvalidOrdersRejectedBeforeDatabase(t *testing.T) {
	for _, body := range []string{
		`{"delivery_email":"buyer@example.com","items":[]}`,
		`{"delivery_email":"buyer@example.com","items":[{"product_id":1,"quantity":-1}]}`,
		`{"delivery_email":"buyer@example.com","items":[{"product_id":1,"quantity":0}]}`,
		`{"delivery_email":"buyer@example.com","items":[{"product_id":0,"quantity":1}]}`,
		`{"delivery_email":"invalid","items":[{"product_id":1,"quantity":1}]}`,
	} {
		db, _ := mockDB(t)
		w := httptest.NewRecorder()
		orderRouter(db).ServeHTTP(w, httptest.NewRequest("POST", "/orders", strings.NewReader(body)))
		if w.Code != 400 {
			t.Fatalf("body %s: got %d: %s", body, w.Code, w.Body.String())
		}
	}
}

func TestOrderTransaction(t *testing.T) {
	for _, scenario := range []string{"success", "inactive", "insufficient", "save_failure", "commit_failure"} {
		t.Run(scenario, func(t *testing.T) {
			db, mock := mockDB(t)
			mock.ExpectBegin()
			stock := 5
			if scenario == "insufficient" {
				stock = 1
			}
			mock.ExpectQuery(`SELECT .* FROM "products" .*FOR UPDATE`).WithArgs(1, 1).
				WillReturnRows(sqlmock.NewRows([]string{"id", "name", "price", "stock_quantity", "is_active"}).AddRow(1, "Game", 100, stock, scenario != "inactive"))
			if scenario == "inactive" || scenario == "insufficient" {
				mock.ExpectRollback()
			} else {
				mock.ExpectExec(`UPDATE "products" SET "stock_quantity"`).WithArgs(3, 1).WillReturnResult(sqlmock.NewResult(0, 1))
				query := mock.ExpectQuery(`INSERT INTO "orders"`).WithArgs(1, 200.0, "pending", "", "buyer@example.com")
				if scenario == "save_failure" {
					query.WillReturnError(errors.New("write failed"))
					mock.ExpectRollback()
				} else {
					query.WillReturnRows(sqlmock.NewRows([]string{"id", "created_at"}).AddRow(10, time.Now()))
					mock.ExpectQuery(`INSERT INTO "order_items"`).WithArgs(10, 1, 2, 100.0, "").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(20))
					if scenario == "commit_failure" {
						mock.ExpectCommit().WillReturnError(errors.New("commit failed"))
					} else {
						mock.ExpectCommit()
					}
				}
			}
			w := httptest.NewRecorder()
			// Duplicate lines must be aggregated before checking and reserving stock.
			body := `{"delivery_email":"buyer@example.com","items":[{"product_id":1,"quantity":1},{"product_id":1,"quantity":1}]}`
			orderRouter(db).ServeHTTP(w, httptest.NewRequest("POST", "/orders", strings.NewReader(body)))
			want := 201
			switch scenario {
			case "inactive", "insufficient":
				want = 400
			case "save_failure", "commit_failure":
				want = 500
			}
			if w.Code != want {
				t.Fatalf("got %d want %d: %s", w.Code, want, w.Body.String())
			}
			if scenario == "success" && !strings.Contains(w.Body.String(), `"status":"pending"`) {
				t.Fatal(w.Body.String())
			}
		})
	}
}

func TestAuthenticationUsesCurrentAccount(t *testing.T) {
	const secret = "test-only-secret-at-least-32-bytes-long"
	for _, scenario := range []string{"demoted", "banned", "deleted", "missing_secret", "missing_expiry", "bad_id", "wrong_algorithm"} {
		t.Run(scenario, func(t *testing.T) {
			t.Setenv("JWT_SECRET", secret)
			db, mock := mockDB(t)
			DB = db
			claims := jwt.MapClaims{"user_id": 1, "role": "superadmin", "exp": time.Now().Add(time.Hour).Unix()}
			method := jwt.SigningMethodHS256
			switch scenario {
			case "missing_secret":
				t.Setenv("JWT_SECRET", "")
			case "missing_expiry":
				delete(claims, "exp")
			case "bad_id":
				claims["user_id"] = "invalid"
			case "wrong_algorithm":
				method = jwt.SigningMethodHS384
			default:
				query := mock.ExpectQuery(`SELECT .* FROM "users"`).WithArgs(1, 1)
				rows := sqlmock.NewRows([]string{"id", "role", "status"})
				if scenario != "deleted" {
					status := "Active"
					if scenario == "banned" {
						status = "Banned"
					}
					rows.AddRow(1, "customer", status)
				}
				query.WillReturnRows(rows)
			}
			token, err := jwt.NewWithClaims(method, claims).SignedString([]byte(secret))
			if err != nil {
				t.Fatal(err)
			}
			r := gin.New()
			r.GET("/admin", AuthMiddleware(), AdminMiddleware(), func(c *gin.Context) { c.Status(200) })
			req := httptest.NewRequest("GET", "/admin", nil)
			req.Header.Set("Authorization", "Bearer "+token)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			want := 401
			if scenario == "demoted" || scenario == "banned" {
				want = 403
			}
			if scenario == "missing_secret" {
				want = 503
			}
			if w.Code != want {
				t.Fatalf("got %d want %d: %s", w.Code, want, w.Body.String())
			}
		})
	}
}

func TestUpdateOrderStatusKeyDeliveryAndCancelRestoresStock(t *testing.T) {
	t.Run("paid_generates_keys", func(t *testing.T) {
		db, mock := mockDB(t)
		mock.ExpectBegin()
		mock.ExpectQuery(`SELECT .* FROM "orders" .*FOR UPDATE`).WithArgs(10, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "total_price", "status", "delivery_email"}).AddRow(10, 1, 200.0, "pending", "buyer@example.com"))
		mock.ExpectQuery(`SELECT .* FROM "order_items"`).WithArgs(10).
			WillReturnRows(sqlmock.NewRows([]string{"id", "order_id", "product_id", "quantity", "price_at_time_of_purchase", "game_keys"}).AddRow(20, 10, 1, 2, 100.0, ""))
		mock.ExpectExec(`UPDATE "order_items" SET "game_keys"`).WithArgs(sqlmock.AnyArg(), 20).WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectExec(`UPDATE "orders" SET "status"`).WithArgs("paid", 10).WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		ord, err := updateOrderStatus(db, 10, "paid")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ord.Status != "paid" || len(ord.Items) != 1 {
			t.Fatalf("unexpected order state: %+v", ord)
		}
		keys := strings.Split(ord.Items[0].GameKeys, ",")
		if len(keys) != 2 || !strings.HasPrefix(keys[0], "DGK-") {
			t.Fatalf("expected 2 generated keys, got %q", ord.Items[0].GameKeys)
		}
	})

	t.Run("cancel_restores_stock", func(t *testing.T) {
		db, mock := mockDB(t)
		mock.ExpectBegin()
		mock.ExpectQuery(`SELECT .* FROM "orders" .*FOR UPDATE`).WithArgs(10, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "total_price", "status", "delivery_email"}).AddRow(10, 1, 200.0, "pending", "buyer@example.com"))
		mock.ExpectQuery(`SELECT .* FROM "order_items"`).WithArgs(10).
			WillReturnRows(sqlmock.NewRows([]string{"id", "order_id", "product_id", "quantity", "price_at_time_of_purchase", "game_keys"}).AddRow(20, 10, 1, 2, 100.0, ""))
		mock.ExpectQuery(`SELECT .* FROM "products" .*FOR UPDATE`).WithArgs(1, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "name", "stock_quantity"}).AddRow(1, "Game", 3))
		mock.ExpectExec(`UPDATE "products" SET "stock_quantity"`).WithArgs(5, 1).WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectExec(`UPDATE "orders" SET "status"`).WithArgs("cancelled", 10).WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		ord, err := updateOrderStatus(db, 10, "cancelled")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ord.Status != "cancelled" {
			t.Fatalf("want status cancelled, got %s", ord.Status)
		}
	})
}

func TestWebhookSignatureVerification(t *testing.T) {
	payload := []byte(`{"order_id":10,"status":"paid"}`)
	secret := "webhook-secret-key-for-hmac-test"
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	validSig := hex.EncodeToString(mac.Sum(nil))

	if !verifyWebhookSignature(payload, validSig, secret) {
		t.Fatal("expected valid signature to pass")
	}
	if !verifyWebhookSignature(payload, "sha256="+validSig, secret) {
		t.Fatal("expected sha256= prefixed signature to pass")
	}
	if verifyWebhookSignature(payload, "invalid", secret) {
		t.Fatal("expected invalid signature to fail")
	}
	if verifyWebhookSignature(payload, validSig, "") {
		t.Fatal("expected empty secret to fail")
	}
}

