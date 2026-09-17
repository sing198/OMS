package main

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"

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
