package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type orderError struct {
	status  int
	message string
}

func (e *orderError) Error() string { return e.message }

func createOrderHandler(c *gin.Context) {
	var req OrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "กรุณาระบุอีเมลและรายการสินค้าที่มีจำนวนเป็นบวก (ไม่เกิน 100 รายการ)"})
		return
	}
	order, err := placeOrder(DB, c.MustGet("user_id").(int), req)
	if err != nil {
		var inputErr *orderError
		if errors.As(err, &inputErr) {
			c.JSON(inputErr.status, gin.H{"error": inputErr.message})
		} else {
			c.JSON(500, gin.H{"error": "ไม่สามารถบันทึกคำสั่งซื้อได้"})
		}
		return
	}
	c.JSON(201, gin.H{"message": "สร้างคำสั่งซื้อแล้ว รอการตรวจสอบการชำระเงิน", "order_id": order.ID, "total_price": order.TotalPrice, "status": order.Status})
}

// Stock is reserved for pending orders. Lock in ID order to avoid deadlocks
// when concurrent carts contain the same products in different orders.
func placeOrder(db *gorm.DB, userID int, req OrderRequest) (Order, error) {
	order := Order{UserID: userID, Status: "pending", DeliveryEmail: req.DeliveryEmail, CouponUsed: strings.TrimSpace(req.CouponCode)}
	quantities := make(map[int]int)
	if len(req.Items) == 0 || len(req.Items) > 100 {
		return order, &orderError{400, "รายการสินค้าไม่ถูกต้อง"}
	}
	for _, item := range req.Items {
		if item.ProductID <= 0 || item.Quantity <= 0 || item.Quantity > 10000 {
			return order, &orderError{400, "จำนวนสินค้าไม่ถูกต้อง"}
		}
		quantities[item.ProductID] += item.Quantity
		if quantities[item.ProductID] > 10000 {
			return order, &orderError{400, "จำนวนสินค้าเกินกำหนด"}
		}
	}
	ids := make([]int, 0, len(quantities))
	for id := range quantities {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	err := db.Transaction(func(tx *gorm.DB) error {
		discount := 0.0
		if order.CouponUsed != "" {
			var coupon Coupon
			if err := tx.Where("code = ?", order.CouponUsed).First(&coupon).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return &orderError{400, "โค้ดส่วนลดไม่ถูกต้อง"}
				}
				return err
			}
			if coupon.Discount < 0 || coupon.Discount > 100 || math.IsNaN(coupon.Discount) || math.IsInf(coupon.Discount, 0) {
				return &orderError{400, "ส่วนลดไม่ถูกต้อง"}
			}
			discount = coupon.Discount / 100
		}
		items := make([]OrderItem, 0, len(ids))
		for _, id := range ids {
			var product Product
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&product, id).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return &orderError{404, "ไม่พบสินค้า"}
				}
				return err
			}
			quantity := quantities[id]
			if !product.IsActive || product.StockQuantity < quantity {
				return &orderError{400, fmt.Sprintf("สินค้า %s ปิดขายหรือสต็อกไม่เพียงพอ", product.Name)}
			}
			if product.Price < 0 || math.IsNaN(product.Price) || math.IsInf(product.Price, 0) || product.DiscountPercent < 0 || product.DiscountPercent > 100 {
				return &orderError{400, "ราคาสินค้าไม่ถูกต้อง"}
			}
			price := math.Round(product.Price*(1-float64(product.DiscountPercent)/100)*(1-discount)*100) / 100
			order.TotalPrice += price * float64(quantity)
			items = append(items, OrderItem{ProductID: id, Quantity: quantity, PriceAtTimeOfPurchase: price})
			if err := tx.Model(&product).Update("stock_quantity", product.StockQuantity-quantity).Error; err != nil {
				return err
			}
		}
		order.TotalPrice = math.Round(order.TotalPrice*100) / 100
		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		for i := range items {
			items[i].OrderID = order.ID
		}
		return tx.Create(&items).Error
	})
	return order, err
}

func generateGameKeys(count int) (string, error) {
	if count <= 0 {
		return "", nil
	}
	keys := make([]string, 0, count)
	for i := 0; i < count; i++ {
		b := make([]byte, 8)
		if _, err := rand.Read(b); err != nil {
			return "", err
		}
		h := strings.ToUpper(hex.EncodeToString(b))
		keys = append(keys, fmt.Sprintf("DGK-%s-%s-%s-%s", h[0:4], h[4:8], h[8:12], h[12:16]))
	}
	return strings.Join(keys, ","), nil
}

// updateOrderStatus transitions an order safely inside a transaction:
// - Transitioning to 'cancelled' from a non-cancelled state restores reserved product stock (locking products in ID order).
// - Transitioning to 'paid', 'shipped', or 'delivered' generates and assigns digital game keys for any item missing keys.
func updateOrderStatus(db *gorm.DB, orderID int, newStatus string) (Order, error) {
	newStatus = strings.ToLower(strings.TrimSpace(newStatus))
	validStatuses := map[string]bool{
		"pending":   true,
		"paid":      true,
		"shipped":   true,
		"delivered": true,
		"cancelled": true,
	}
	if !validStatuses[newStatus] {
		return Order{}, &orderError{400, "สถานะคำสั่งซื้อไม่ถูกต้อง"}
	}

	var updatedOrder Order
	err := db.Transaction(func(tx *gorm.DB) error {
		var order Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, orderID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &orderError{404, "ไม่พบคำสั่งซื้อ"}
			}
			return err
		}

		oldStatus := strings.ToLower(order.Status)
		if oldStatus == newStatus {
			updatedOrder = order
			return nil
		}

		// Prevent un-cancelling an already cancelled order since stock was already released
		if oldStatus == "cancelled" && newStatus != "cancelled" {
			return &orderError{400, "ไม่สามารถเปลี่ยนสถานะคำสั่งซื้อที่ถูกยกเลิกไปแล้วได้"}
		}

		var items []OrderItem
		if err := tx.Where("order_id = ?", order.ID).Order("id asc").Find(&items).Error; err != nil {
			return err
		}

		if newStatus == "cancelled" && oldStatus != "cancelled" {
			// Group quantities by product ID and lock products in ascending ID order to avoid deadlocks
			qtyByProduct := make(map[int]int)
			for _, item := range items {
				qtyByProduct[item.ProductID] += item.Quantity
			}
			pids := make([]int, 0, len(qtyByProduct))
			for pid := range qtyByProduct {
				pids = append(pids, pid)
			}
			sort.Ints(pids)

			for _, pid := range pids {
				var prod Product
				if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&prod, pid).Error; err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						continue
					}
					return err
				}
				if err := tx.Model(&prod).Update("stock_quantity", prod.StockQuantity+qtyByProduct[pid]).Error; err != nil {
					return err
				}
			}
		}

		if newStatus == "paid" || newStatus == "shipped" || newStatus == "delivered" {
			for i := range items {
				if strings.TrimSpace(items[i].GameKeys) == "" {
					keys, err := generateGameKeys(items[i].Quantity)
					if err != nil {
						return err
					}
					items[i].GameKeys = keys
					if err := tx.Model(&OrderItem{}).Where("id = ?", items[i].ID).Update("game_keys", keys).Error; err != nil {
						return err
					}
				}
			}
		}

		if err := tx.Model(&order).Update("status", newStatus).Error; err != nil {
			return err
		}
		order.Status = newStatus
		order.Items = items
		updatedOrder = order
		return nil
	})
	return updatedOrder, err
}

// releaseExpiredPendingOrders finds pending orders older than maxAge, cancels them, and restores stock.
func releaseExpiredPendingOrders(db *gorm.DB, maxAge time.Duration) (int, error) {
	cutoff := time.Now().Add(-maxAge)
	var expiredOrders []Order
	if err := db.Where("status = ? AND created_at < ?", "pending", cutoff).Find(&expiredOrders).Error; err != nil {
		return 0, err
	}
	released := 0
	for _, ord := range expiredOrders {
		if _, err := updateOrderStatus(db, ord.ID, "cancelled"); err == nil {
			released++
		}
	}
	return released, nil
}

// verifyWebhookSignature verifies an HMAC-SHA256 webhook signature against the given secret.
func verifyWebhookSignature(payload []byte, signatureHeader string, secret string) bool {
	if secret == "" || signatureHeader == "" {
		return false
	}
	sig := strings.TrimPrefix(strings.TrimSpace(signatureHeader), "sha256=")
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expectedMAC := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(strings.ToLower(sig)), []byte(strings.ToLower(expectedMAC)))
}

