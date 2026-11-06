package main

// Integration tests for placeOrder against a real PostgreSQL database.
//
// They run only when TEST_DATABASE_URL is set, and the database name must
// contain "test" because every test truncates the tables it uses:
//
//	TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/oms_test?sslmode=disable" go test -race ./...
//
// CI starts a disposable postgres:16 service for these tests
// (see .github/workflows/backend-ci.yml).

import (
	"errors"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func integrationDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping PostgreSQL integration test")
	}
	u, err := url.Parse(dsn)
	if err != nil || !strings.Contains(strings.TrimPrefix(u.Path, "/"), "test") {
		t.Fatalf("refusing to run: database name in TEST_DATABASE_URL must contain \"test\" (tables are truncated)")
	}
	if !strings.Contains(dsn, "client_encoding") {
		sep := "?"
		if strings.Contains(dsn, "?") {
			sep = "&"
		}
		dsn += sep + "client_encoding=UTF8"
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(25)
	t.Cleanup(func() { sqlDB.Close() })

	if err := db.AutoMigrate(&User{}, &Category{}, &Tag{}, &Product{}, &Order{}, &OrderItem{}, &Coupon{}); err != nil {
		t.Fatal(err)
	}
	if err := db.Exec("TRUNCATE order_items, orders, product_tags, products, categories, coupons RESTART IDENTITY CASCADE").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&Category{ID: 1, Name: "Action"}).Error; err != nil {
		t.Fatal(err)
	}
	return db
}

func seedProduct(t *testing.T, db *gorm.DB, name string, stock int) Product {
	t.Helper()
	p := Product{Name: name, Price: 100, StockQuantity: stock, IsActive: true, CategoryID: 1}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	return p
}

func orderFor(items ...[2]int) OrderRequest {
	var req OrderRequest
	req.DeliveryEmail = "buyer@example.com"
	for _, it := range items {
		req.Items = append(req.Items, struct {
			ProductID int `json:"product_id" binding:"required,gt=0"`
			Quantity  int `json:"quantity" binding:"required,gt=0,lte=10000"`
		}{ProductID: it[0], Quantity: it[1]})
	}
	return req
}

// runConcurrently calls placeOrder from n goroutines released at the same
// moment and counts successful orders, expected stock rejections and any
// other errors (e.g. deadlocks or serialization failures).
func runConcurrently(t *testing.T, db *gorm.DB, n int, reqFor func(i int) OrderRequest) (ok, rejected int, unexpected []error) {
	t.Helper()
	var (
		mu    sync.Mutex
		wg    sync.WaitGroup
		start = make(chan struct{})
	)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			_, err := placeOrder(db, i+1, reqFor(i))
			mu.Lock()
			defer mu.Unlock()
			var oe *orderError
			switch {
			case err == nil:
				ok++
			case errors.As(err, &oe) && oe.status == 400:
				rejected++
			default:
				unexpected = append(unexpected, err)
			}
		}(i)
	}
	close(start)
	wg.Wait()
	return ok, rejected, unexpected
}

func stockOf(t *testing.T, db *gorm.DB, id int) int {
	t.Helper()
	var p Product
	if err := db.First(&p, id).Error; err != nil {
		t.Fatal(err)
	}
	return p.StockQuantity
}

func countRows(t *testing.T, db *gorm.DB, model any) int64 {
	t.Helper()
	var n int64
	if err := db.Model(model).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

// 50 buyers race for the last key: exactly one order may succeed.
func TestIntegrationLastKeyIsSoldOnce(t *testing.T) {
	db := integrationDB(t)
	p := seedProduct(t, db, "Last key", 1)

	ok, rejected, unexpected := runConcurrently(t, db, 50, func(int) OrderRequest { return orderFor([2]int{p.ID, 1}) })

	if len(unexpected) > 0 {
		t.Fatalf("unexpected errors: %v", unexpected)
	}
	if ok != 1 || rejected != 49 {
		t.Fatalf("want 1 success and 49 rejections, got %d and %d", ok, rejected)
	}
	if s := stockOf(t, db, p.ID); s != 0 {
		t.Fatalf("stock = %d, want 0", s)
	}
	if n := countRows(t, db, &OrderItem{}); n != 1 {
		t.Fatalf("order items = %d, want 1", n)
	}
}

// 50 buyers race for 10 keys: exactly 10 orders succeed and stock never goes negative.
func TestIntegrationLimitedStockNeverOversells(t *testing.T) {
	db := integrationDB(t)
	p := seedProduct(t, db, "Limited stock", 10)

	ok, rejected, unexpected := runConcurrently(t, db, 50, func(int) OrderRequest { return orderFor([2]int{p.ID, 1}) })

	if len(unexpected) > 0 {
		t.Fatalf("unexpected errors: %v", unexpected)
	}
	if ok != 10 || rejected != 40 {
		t.Fatalf("want 10 successes and 40 rejections, got %d and %d", ok, rejected)
	}
	if s := stockOf(t, db, p.ID); s != 0 {
		t.Fatalf("stock = %d, want 0", s)
	}
	if n := countRows(t, db, &Order{}); n != 10 {
		t.Fatalf("orders = %d, want 10", n)
	}
}

// Carts list the same two products in opposite order. Locking rows in ID
// order means none of these transactions should deadlock.
func TestIntegrationOppositeCartOrderDoesNotDeadlock(t *testing.T) {
	db := integrationDB(t)
	a := seedProduct(t, db, "Product A", 1000)
	b := seedProduct(t, db, "Product B", 1000)

	const n = 60
	ok, rejected, unexpected := runConcurrently(t, db, n, func(i int) OrderRequest {
		if i%2 == 0 {
			return orderFor([2]int{a.ID, 1}, [2]int{b.ID, 1})
		}
		return orderFor([2]int{b.ID, 1}, [2]int{a.ID, 1})
	})

	if len(unexpected) > 0 {
		t.Fatalf("unexpected errors (possible deadlock): %v", unexpected)
	}
	if ok != n || rejected != 0 {
		t.Fatalf("want %d successes, got %d (rejected %d)", n, ok, rejected)
	}
	if sa, sb := stockOf(t, db, a.ID), stockOf(t, db, b.ID); sa != 1000-n || sb != 1000-n {
		t.Fatalf("stock = %d/%d, want %d/%d", sa, sb, 1000-n, 1000-n)
	}
}

// If any item fails, the whole order rolls back and earlier stock reservations are undone.
func TestIntegrationFailedOrderRollsBackStock(t *testing.T) {
	db := integrationDB(t)
	inStock := seedProduct(t, db, "In stock", 5)
	soldOut := seedProduct(t, db, "Sold out", 0)

	_, err := placeOrder(db, 1, orderFor([2]int{inStock.ID, 2}, [2]int{soldOut.ID, 1}))

	var oe *orderError
	if !errors.As(err, &oe) || oe.status != 400 {
		t.Fatalf("want stock rejection, got %v", err)
	}
	if s := stockOf(t, db, inStock.ID); s != 5 {
		t.Fatalf("stock of first product = %d, want 5 (rolled back)", s)
	}
	if n := countRows(t, db, &Order{}); n != 0 {
		t.Fatalf("orders = %d, want 0", n)
	}
}

// Paid orders automatically generate digital keys, and expired pending orders restore stock.
func TestIntegrationKeyDeliveryAndExpiredPendingOrderStockRestore(t *testing.T) {
	db := integrationDB(t)
	p := seedProduct(t, db, "Key & Expiry Game", 5)

	ord1, err := placeOrder(db, 1, orderFor([2]int{p.ID, 2}))
	if err != nil {
		t.Fatal(err)
	}
	ord2, err := placeOrder(db, 2, orderFor([2]int{p.ID, 2}))
	if err != nil {
		t.Fatal(err)
	}
	if s := stockOf(t, db, p.ID); s != 1 {
		t.Fatalf("stock after 2 reservations = %d, want 1", s)
	}

	// Transition ord1 to paid -> should generate 2 keys
	paidOrd, err := updateOrderStatus(db, ord1.ID, "paid")
	if err != nil {
		t.Fatal(err)
	}
	if paidOrd.Status != "paid" || len(paidOrd.Items) != 1 || len(strings.Split(paidOrd.Items[0].GameKeys, ",")) != 2 {
		t.Fatalf("expected 2 delivered game keys on paid order, got %+v", paidOrd)
	}

	// Age ord2 by 1 hour and run expiry job -> should cancel ord2 and restore 2 stock (1 -> 3)
	if err := db.Model(&Order{}).Where("id = ?", ord2.ID).Update("created_at", time.Now().Add(-time.Hour)).Error; err != nil {
		t.Fatal(err)
	}
	released, err := releaseExpiredPendingOrders(db, 30*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if released != 1 {
		t.Fatalf("released = %d, want 1", released)
	}
	if s := stockOf(t, db, p.ID); s != 3 {
		t.Fatalf("stock after expiring ord2 = %d, want 3", s)
	}
}

