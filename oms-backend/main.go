package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

// ==========================================
// 📦 Models สำหรับระบบสินค้า
// ==========================================

type Category struct {
	ID   int    `json:"id" gorm:"primaryKey"`
	Name string `json:"name" gorm:"unique"`
}

type Tag struct {
	ID   int    `json:"id" gorm:"primaryKey"`
	Name string `json:"name" gorm:"unique"`
}

type Product struct {
	ID              int     `json:"id" gorm:"primaryKey"`
	Name            string  `json:"name"`
	Description     string  `json:"description"`
	Price           float64 `json:"price"`
	StockQuantity   int     `json:"stock_quantity"`
	ImageUrl        string  `json:"image_url"`
	Platform        string  `json:"platform" gorm:"default:'Steam'"`
	DiscountPercent int     `json:"discount_percent" gorm:"default:0"`
	IsActive        bool    `json:"is_active" gorm:"default:true"`

	CategoryID uint     `json:"category_id"`
	Category   Category `json:"category" gorm:"foreignKey:CategoryID"`
	Tags       []Tag    `json:"tags" gorm:"many2many:product_tags;"`
}

// ==========================================
// 🛒 Models สำหรับคำสั่งซื้อ
// ==========================================

type Order struct {
	ID            int         `json:"id" gorm:"primaryKey"`
	UserID        int         `json:"user_id"`
	TotalPrice    float64     `json:"total_price"`
	Status        string      `json:"status" gorm:"default:'pending'"` // paid, shipped, delivered, cancelled
	Items         []OrderItem `json:"items" gorm:"foreignKey:OrderID"`
	CouponUsed    string      `json:"coupon_used"`
	DeliveryEmail string      `json:"delivery_email"`
	CreatedAt     time.Time   `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
}

type OrderItem struct {
	ID                    int     `json:"id" gorm:"primaryKey"`
	OrderID               int     `json:"order_id"`
	ProductID             int     `json:"product_id"`
	Quantity              int     `json:"quantity"`
	PriceAtTimeOfPurchase float64 `json:"price_at_time_of_purchase"`
	GameKeys              string  `json:"game_keys"`
	Product               Product `json:"product" gorm:"foreignKey:ProductID"`
}

type OrderRequest struct {
	Items []struct {
		ProductID int `json:"product_id" binding:"required,gt=0"`
		Quantity  int `json:"quantity" binding:"required,gt=0,lte=10000"`
	} `json:"items" binding:"required,min=1,max=100,dive"`
	CouponCode    string `json:"coupon_code"`
	DeliveryEmail string `json:"delivery_email" binding:"required,email"`
}

// ==========================================
// 👤 Models สำหรับระบบ Auth และ Admin
// ==========================================

type User struct {
	ID           int       `json:"id" gorm:"primaryKey"`
	Name         string    `json:"name"`
	Email        string    `json:"email" gorm:"unique"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role" gorm:"default:'customer'"`
	CreatedAt    time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	Status       string    `json:"status" gorm:"default:'Active'"`
}

type RegisterInput struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type Coupon struct {
	ID       int     `json:"id" gorm:"primaryKey"`
	Code     string  `json:"code" gorm:"unique"`
	Discount float64 `json:"discount"`
}

type AdminLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	AdminID   uint      `json:"admin_id"`
	AdminName string    `json:"admin_name"`
	Action    string    `json:"action"`
	TargetID  string    `json:"target_id"`
	Details   string    `json:"details"`
	CreatedAt time.Time `json:"created_at"`
}

// ==========================================
// 🛡️ Middlewares และ Helpers
// ==========================================

type authClaims struct {
	UserID int `json:"user_id"`
	jwt.RegisteredClaims
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.JSON(401, gin.H{"error": "กรุณาเข้าสู่ระบบ (Missing Token)"})
			c.Abort()
			return
		}

		if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
			tokenString = tokenString[7:]
		}

		secret := os.Getenv("JWT_SECRET")
		if len(secret) < 32 {
			c.AbortWithStatusJSON(503, gin.H{"error": "Authentication is not configured"})
			return
		}
		claims := &authClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
		if err != nil || !token.Valid || claims.UserID <= 0 {
			c.AbortWithStatusJSON(401, gin.H{"error": "Token ไม่ถูกต้อง หรือหมดอายุแล้ว"})
			return
		}
		var user User
		if err := DB.First(&user, claims.UserID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.AbortWithStatusJSON(401, gin.H{"error": "ไม่พบผู้ใช้งาน"})
			} else {
				c.AbortWithStatusJSON(503, gin.H{"error": "ไม่สามารถตรวจสอบผู้ใช้งานได้"})
			}
			return
		}
		if user.Status != "Active" {
			c.AbortWithStatusJSON(403, gin.H{"error": "บัญชีถูกระงับการใช้งาน"})
			return
		}
		c.Set("user_id", user.ID)
		c.Set("role", strings.ToLower(user.Role))
		c.Next()
	}
}

func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("role")
		if !exists {
			c.JSON(403, gin.H{"error": "Forbidden: สิทธิ์การเข้าถึงถูกปฏิเสธ"})
			c.Abort()
			return
		}

		roleStr, ok := roleVal.(string)
		if !ok {
			c.JSON(403, gin.H{"error": "Forbidden: รูปแบบสิทธิ์ไม่ถูกต้อง"})
			c.Abort()
			return
		}

		role := strings.ToLower(roleStr)
		if role != "admin" && role != "superadmin" {
			c.JSON(403, gin.H{"error": "Forbidden: สิทธิ์การเข้าถึงถูกปฏิเสธ (ต้องเป็น Admin หรือ Super Admin เท่านั้น)"})
			c.Abort()
			return
		}
		c.Next()
	}
}

func LogAdminAction(adminID uint, adminName string, action string, targetID string, details string) {
	log := AdminLog{
		AdminID:   adminID,
		AdminName: adminName,
		Action:    action,
		TargetID:  targetID,
		Details:   details,
		CreatedAt: time.Now(),
	}
	if err := DB.Create(&log).Error; err != nil {
		fmt.Println("❌ Failed to save admin log:", err)
	}
}

func getAdminInfo(c *gin.Context) (uint, string) {
	adminIDVal, _ := c.Get("user_id")
	var adminID int
	if val, ok := adminIDVal.(int); ok {
		adminID = val
	} else if val, ok := adminIDVal.(float64); ok {
		adminID = int(val)
	}

	var adminUser User
	adminName := "Unknown Admin"
	if err := DB.Select("name").Where("id = ?", adminID).First(&adminUser).Error; err == nil {
		adminName = adminUser.Name
	}
	return uint(adminID), adminName
}

func main() {
	// ==========================================
	// ⚙️ 1. ตั้งค่า Environment และ Database
	// ==========================================
	err := godotenv.Load()
	if err != nil {
		fmt.Println("⚠️ No .env file found, reading from Cloud Environment Variables instead")
	}

	if len(os.Getenv("JWT_SECRET")) < 32 {
		log.Fatal("JWT_SECRET must contain at least 32 bytes; generate a random secret before starting")
	}
	dsn := os.Getenv("DATABASE_URL")
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("❌ Failed to connect to database:", err)
	}
	fmt.Println("✅ Successfully connected to Supabase PostgreSQL!")

	// เพิ่ม Models ใหม่ลงใน AutoMigrate
	if err := DB.AutoMigrate(&User{}, &Category{}, &Tag{}, &Product{}, &Order{}, &OrderItem{}, &Coupon{}, &AdminLog{}); err != nil {
		log.Fatal("Failed to migrate database: ", err)
	}

	// 🔄 Background Job: คืนสต็อกจากออเดอร์ที่ค้างสถานะ pending เกินเวลาที่กำหนด (ค่าเริ่มต้น 30 นาที)
	expiryMinutes := 30
	if envMin := os.Getenv("ORDER_EXPIRY_MINUTES"); envMin != "" {
		if parsed, err := strconv.Atoi(envMin); err == nil && parsed > 0 {
			expiryMinutes = parsed
		}
	}
	go func(maxAge time.Duration) {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			if released, err := releaseExpiredPendingOrders(DB, maxAge); err == nil && released > 0 {
				fmt.Printf("♻️ Auto-expired %d abandoned pending order(s) and restored stock\n", released)
			}
		}
	}(time.Duration(expiryMinutes) * time.Minute)

	// สร้างแฟ้มอัปโหลดรูปภาพถ้ายังไม่มี
	if _, err := os.Stat("uploads"); os.IsNotExist(err) {
		os.Mkdir("uploads", 0755)
	}

	// ==========================================
	// 🌐 2. ตั้งค่า Router และ CORS
	// ==========================================
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false, // 🛡️ แก้ไข: AllowOrigins=* กับ AllowCredentials=true ใช้ด้วยกันไม่ได้ตาม CORS spec
		MaxAge:           12 * time.Hour,
	}))

	// เสิร์ฟไฟล์ Static สำหรับโฟลเดอร์ uploads
	r.Static("/uploads", "./uploads")

	// ==========================================
	// 🟢 โซน 1: Public API (ไม่ต้องใช้ Token)
	// ==========================================

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong! Server is running."})
	})

	r.POST("/register", func(c *gin.Context) {
		var input RegisterInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "กรุณากรอกข้อมูลให้ครบถ้วน"})
			return
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(500, gin.H{"error": "ไม่สามารถเข้ารหัสผ่านได้"})
			return
		}

		newUser := User{
			Name:         input.Name,
			Email:        input.Email,
			PasswordHash: string(hashedPassword),
			Role:         "customer",
			Status:       "Active",
		}

		if err := DB.Create(&newUser).Error; err != nil {
			c.JSON(400, gin.H{"error": "อีเมลนี้มีในระบบแล้ว หรือบันทึกข้อมูลไม่ได้"})
			return
		}

		c.JSON(201, gin.H{"message": "สมัครสมาชิกสำเร็จ", "user_id": newUser.ID})
	})

	r.POST("/login", func(c *gin.Context) {
		var input LoginInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "กรุณากรอกข้อมูลให้ครบถ้วน"})
			return
		}

		var user User
		if err := DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
			c.JSON(401, gin.H{"error": "อีเมลหรือรหัสผ่านไม่ถูกต้อง"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
			c.JSON(401, gin.H{"error": "อีเมลหรือรหัสผ่านไม่ถูกต้อง"})
			return
		}

		if user.Status == "Banned" || user.Status == "Suspended" {
			c.JSON(403, gin.H{"error": "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อแอดมิน"})
			return
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id": user.ID,
			"role":    user.Role,
			"exp":     time.Now().Add(time.Hour * 24).Unix(),
		})

		secret := os.Getenv("JWT_SECRET")
		secretKey := []byte(secret)
		tokenString, err := token.SignedString(secretKey)
		if err != nil {
			c.JSON(500, gin.H{"error": "ไม่สามารถสร้าง Token ได้"})
			return
		}

		c.JSON(200, gin.H{
			"message": "เข้าสู่ระบบสำเร็จ",
			"token":   tokenString,
			"name":    user.Name,
			"role":    user.Role,
		})
	})

	// 🔍 [NEW] GET /products พร้อมระบบ Search, Filter, Pagination
	r.GET("/products", func(c *gin.Context) {
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		if page < 1 {
			page = 1
		}
		if limit < 1 {
			limit = 10
		}

		search := c.Query("search")
		categoryID := c.Query("category")
		platform := c.Query("platform")

		query := DB.Model(&Product{}).Where("is_active = ?", true)

		if search != "" {
			query = query.Where("name ILIKE ?", "%"+search+"%")
		}
		if categoryID != "" {
			query = query.Where("category_id = ?", categoryID)
		}
		if platform != "" {
			query = query.Where("platform = ?", platform)
		}

		var total int64
		query.Count(&total)

		var products []Product
		offset := (page - 1) * limit
		if err := query.Preload("Category").Preload("Tags").Offset(offset).Limit(limit).Find(&products).Error; err != nil {
			c.JSON(500, gin.H{"error": "ไม่สามารถดึงข้อมูลสินค้าได้"})
			return
		}

		c.JSON(200, gin.H{
			"data": products,
			"meta": gin.H{
				"total":       total,
				"page":        page,
				"limit":       limit,
				"total_pages": (total + int64(limit) - 1) / int64(limit),
			},
		})
	})

	r.GET("/products/:id", func(c *gin.Context) {
		id := c.Param("id")
		var product Product
		if err := DB.Preload("Category").Preload("Tags").First(&product, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "ไม่พบข้อมูลเกมนี้"})
			return
		}
		c.JSON(200, product)
	})

	r.POST("/validate-coupon", func(c *gin.Context) {
		var input struct {
			Code string `json:"code"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "รูปแบบข้อมูลไม่ถูกต้อง"})
			return
		}

		var coupon Coupon
		if err := DB.Where("code = ?", input.Code).First(&coupon).Error; err != nil {
			c.JSON(404, gin.H{"error": "โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุ"})
			return
		}
		c.JSON(200, gin.H{"discount": coupon.Discount})
	})

	// 🔍 [NEW] หมวดหมู่ & แท็ก
	r.GET("/categories", func(c *gin.Context) {
		var cats []Category
		DB.Find(&cats)
		c.JSON(200, cats)
	})

	r.GET("/tags", func(c *gin.Context) {
		var tags []Tag
		DB.Find(&tags)
		c.JSON(200, tags)
	})

	// 💳 [NEW] Payment Gateway Webhook Verification & Automatic Key Delivery
	r.POST("/webhooks/payment", func(c *gin.Context) {
		webhookSecret := os.Getenv("WEBHOOK_SECRET")
		if webhookSecret == "" {
			webhookSecret = os.Getenv("JWT_SECRET")
		}
		signature := c.GetHeader("X-Webhook-Signature")
		bodyBytes, err := c.GetRawData()
		if err != nil || !verifyWebhookSignature(bodyBytes, signature, webhookSecret) {
			c.JSON(401, gin.H{"error": "Invalid webhook signature"})
			return
		}
		var payload struct {
			OrderID int    `json:"order_id" binding:"required"`
			Status  string `json:"status" binding:"required"`
		}
		if err := json.Unmarshal(bodyBytes, &payload); err != nil || payload.OrderID <= 0 {
			c.JSON(400, gin.H{"error": "Invalid webhook payload"})
			return
		}
		status := strings.ToLower(strings.TrimSpace(payload.Status))
		if status != "paid" && status != "cancelled" {
			c.JSON(400, gin.H{"error": "Unsupported webhook status"})
			return
		}
		updatedOrder, err := updateOrderStatus(DB, payload.OrderID, status)
		if err != nil {
			var oe *orderError
			if errors.As(err, &oe) {
				c.JSON(oe.status, gin.H{"error": oe.message})
			} else {
				c.JSON(500, gin.H{"error": "Failed to process webhook"})
			}
			return
		}
		c.JSON(200, gin.H{"message": "Webhook processed", "order": updatedOrder})
	})

	// ==========================================
	// 🟡 โซน 2: Protected API (ต้อง Login / ใช้ Token)
	// ==========================================
	protected := r.Group("/")
	protected.Use(AuthMiddleware())

	protected.POST("/orders", createOrderHandler)

	// 💳 [NEW] Instant Payment Simulation & Automatic Key Delivery for Customer
	protected.POST("/orders/:id/pay", func(c *gin.Context) {
		userID := c.MustGet("user_id").(int)
		role := c.MustGet("role").(string)
		orderID, err := strconv.Atoi(c.Param("id"))
		if err != nil || orderID <= 0 {
			c.JSON(400, gin.H{"error": "รหัสคำสั่งซื้อไม่ถูกต้อง"})
			return
		}
		var order Order
		if err := DB.First(&order, orderID).Error; err != nil {
			c.JSON(404, gin.H{"error": "ไม่พบคำสั่งซื้อ"})
			return
		}
		if order.UserID != userID && role != "admin" && role != "superadmin" {
			c.JSON(403, gin.H{"error": "ไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้"})
			return
		}
		updatedOrder, err := updateOrderStatus(DB, orderID, "paid")
		if err != nil {
			var oe *orderError
			if errors.As(err, &oe) {
				c.JSON(oe.status, gin.H{"error": oe.message})
			} else {
				c.JSON(500, gin.H{"error": "ไม่สามารถยืนยันการชำระเงินได้"})
			}
			return
		}
		c.JSON(200, gin.H{
			"message": "ชำระเงินสำเร็จและจัดส่งคีย์เกมอัตโนมัติเรียบร้อยแล้ว",
			"order":   updatedOrder,
		})
	})

	// ❌ [NEW] Customer Cancel Pending Order & Restore Stock
	protected.POST("/orders/:id/cancel", func(c *gin.Context) {
		userID := c.MustGet("user_id").(int)
		role := c.MustGet("role").(string)
		orderID, err := strconv.Atoi(c.Param("id"))
		if err != nil || orderID <= 0 {
			c.JSON(400, gin.H{"error": "รหัสคำสั่งซื้อไม่ถูกต้อง"})
			return
		}
		var order Order
		if err := DB.First(&order, orderID).Error; err != nil {
			c.JSON(404, gin.H{"error": "ไม่พบคำสั่งซื้อ"})
			return
		}
		if order.UserID != userID && role != "admin" && role != "superadmin" {
			c.JSON(403, gin.H{"error": "ไม่มีสิทธิ์ยกเลิกคำสั่งซื้อนี้"})
			return
		}
		if strings.ToLower(order.Status) != "pending" && role != "admin" && role != "superadmin" {
			c.JSON(400, gin.H{"error": "สามารถยกเลิกได้เฉพาะคำสั่งซื้อที่รอชำระเงินเท่านั้น"})
			return
		}
		updatedOrder, err := updateOrderStatus(DB, orderID, "cancelled")
		if err != nil {
			var oe *orderError
			if errors.As(err, &oe) {
				c.JSON(oe.status, gin.H{"error": oe.message})
			} else {
				c.JSON(500, gin.H{"error": "ไม่สามารถยกเลิกคำสั่งซื้อได้"})
			}
			return
		}
		c.JSON(200, gin.H{
			"message": "ยกเลิกคำสั่งซื้อและคืนสต็อกสินค้าเรียบร้อยแล้ว",
			"order":   updatedOrder,
		})
	})

	// 🔍 [MODIFY] GET /orders พร้อมระบบ Pagination, Search และ Filter
	protected.GET("/orders", func(c *gin.Context) {
		userID := c.MustGet("user_id").(int)
		role := c.MustGet("role").(string)

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		if page < 1 {
			page = 1
		}
		if limit < 1 {
			limit = 10
		}
		if limit > 100 {
			limit = 100
		}

		statusFilter := strings.ToLower(strings.TrimSpace(c.Query("status")))
		search := strings.TrimSpace(c.Query("search"))
		filterUserID := strings.TrimSpace(c.Query("user_id"))

		query := DB.Model(&Order{})

		if role != "admin" && role != "superadmin" {
			query = query.Where("user_id = ?", userID)
		} else if filterUserID != "" {
			if uid, err := strconv.Atoi(filterUserID); err == nil {
				query = query.Where("user_id = ?", uid)
			}
		}

		if statusFilter != "" && statusFilter != "all" {
			query = query.Where("LOWER(status) = ?", statusFilter)
		}

		if search != "" {
			if searchID, err := strconv.Atoi(strings.TrimPrefix(search, "#")); err == nil {
				query = query.Where("id = ? OR user_id = ? OR delivery_email ILIKE ?", searchID, searchID, "%"+search+"%")
			} else {
				query = query.Where("delivery_email ILIKE ?", "%"+search+"%")
			}
		}

		var total int64
		query.Count(&total)

		var orders []Order
		offset := (page - 1) * limit
		if err := query.Preload("Items.Product").Order("created_at desc").Offset(offset).Limit(limit).Find(&orders).Error; err != nil {
			c.JSON(500, gin.H{"error": "ไม่สามารถดึงข้อมูลได้"})
			return
		}

		// Calculate overall summary stats for admin dashboard
		var totalRevenue float64
		var pendingCount int64
		if role == "admin" || role == "superadmin" {
			DB.Model(&Order{}).Where("status IN ?", []string{"paid", "shipped", "delivered"}).Select("COALESCE(SUM(total_price), 0)").Scan(&totalRevenue)
			DB.Model(&Order{}).Where("status = ?", "pending").Count(&pendingCount)
		}

		c.JSON(200, gin.H{
			"data": orders,
			"meta": gin.H{
				"total":         total,
				"page":          page,
				"limit":         limit,
				"total_pages":   (total + int64(limit) - 1) / int64(limit),
				"total_revenue": totalRevenue,
				"pending_count": pendingCount,
			},
		})
	})

	// ==========================================
	// 🔴 โซน 3: Admin API (ต้อง Login + เป็น Admin)
	// ==========================================
	admin := protected.Group("/admin") // Group เป็น /admin จะได้เข้าถึงง่าย
	admin.Use(AdminMiddleware())

	// 🔍 [NEW] Upload Image API
	admin.POST("/upload", func(c *gin.Context) {
		file, err := c.FormFile("image")
		if err != nil {
			c.JSON(400, gin.H{"error": "ไม่พบไฟล์ที่อัปโหลด"})
			return
		}

		ext := strings.ToLower(filepath.Ext(file.Filename))
		// 🛡️ ป้องกันการอัปโหลดไฟล์อันตราย อนุญาตเฉพาะรูปภาพ
		if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" && ext != ".webp" {
			c.JSON(400, gin.H{"error": "อนุญาตให้อัปโหลดเฉพาะไฟล์รูปภาพเท่านั้น (jpg, jpeg, png, gif, webp)"})
			return
		}

		newFilename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
		savePath := filepath.Join("uploads", newFilename)

		if err := c.SaveUploadedFile(file, savePath); err != nil {
			c.JSON(500, gin.H{"error": "บันทึกไฟล์ไม่สำเร็จ"})
			return
		}

		fileUrl := "/uploads/" + newFilename
		c.JSON(200, gin.H{"url": fileUrl})
	})

	// 🔍 [NEW] Category & Tag API (Admin)
	admin.POST("/categories", func(c *gin.Context) {
		var cat Category
		if err := c.ShouldBindJSON(&cat); err != nil {
			c.JSON(400, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
			return
		}
		if err := DB.Create(&cat).Error; err != nil {
			c.JSON(500, gin.H{"error": "สร้างหมวดหมู่ไม่สำเร็จ"})
			return
		}
		c.JSON(201, cat)
	})

	admin.POST("/tags", func(c *gin.Context) {
		var tag Tag
		if err := c.ShouldBindJSON(&tag); err != nil {
			c.JSON(400, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
			return
		}
		if err := DB.Create(&tag).Error; err != nil {
			c.JSON(500, gin.H{"error": "สร้างแท็กไม่สำเร็จ"})
			return
		}
		c.JSON(201, tag)
	})

	// 🔍 [NEW] Admin Coupon Management
	admin.GET("/coupons", func(c *gin.Context) {
		var coupons []Coupon
		DB.Find(&coupons)
		c.JSON(200, coupons)
	})

	admin.POST("/coupons", func(c *gin.Context) {
		var coupon Coupon
		if err := c.ShouldBindJSON(&coupon); err != nil {
			c.JSON(400, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
			return
		}
		coupon.Code = strings.ToUpper(strings.TrimSpace(coupon.Code))
		if coupon.Code == "" || coupon.Discount <= 0 || coupon.Discount > 100 {
			c.JSON(400, gin.H{"error": "รหัสคูปองและส่วนลด (1-100%) ไม่ถูกต้อง"})
			return
		}
		if err := DB.Create(&coupon).Error; err != nil {
			c.JSON(500, gin.H{"error": "สร้างคูปองไม่สำเร็จ หรือรหัสซ้ำ"})
			return
		}

		adminID, adminName := getAdminInfo(c)
		LogAdminAction(adminID, adminName, "CREATE_COUPON", fmt.Sprintf("%d", coupon.ID), fmt.Sprintf("สร้างคูปองใหม่รหัส %s", coupon.Code))
		c.JSON(201, coupon)
	})

	admin.PUT("/coupons/:id", func(c *gin.Context) {
		id := c.Param("id")
		var coupon Coupon
		if err := DB.First(&coupon, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "ไม่พบคูปอง"})
			return
		}
		var input Coupon
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
			return
		}
		input.Code = strings.ToUpper(strings.TrimSpace(input.Code))
		if input.Code == "" || input.Discount <= 0 || input.Discount > 100 {
			c.JSON(400, gin.H{"error": "รหัสคูปองและส่วนลด (1-100%) ไม่ถูกต้อง"})
			return
		}
		coupon.Code = input.Code
		coupon.Discount = input.Discount
		DB.Save(&coupon)

		adminID, adminName := getAdminInfo(c)
		LogAdminAction(adminID, adminName, "UPDATE_COUPON", id, fmt.Sprintf("อัปเดตคูปอง %s", coupon.Code))
		c.JSON(200, coupon)
	})

	admin.DELETE("/coupons/:id", func(c *gin.Context) {
		id := c.Param("id")
		DB.Delete(&Coupon{}, id)

		adminID, adminName := getAdminInfo(c)
		LogAdminAction(adminID, adminName, "DELETE_COUPON", id, "ลบคูปอง")
		c.JSON(200, gin.H{"message": "ลบคูปองสำเร็จ"})
	})

	// 🔍 [MODIFY] Admin Order Status Update (พร้อมระบบตัด/คืนสต็อกและออกคีย์เกมอัตโนมัติ)
	admin.PATCH("/orders/:id/status", func(c *gin.Context) {
		id := c.Param("id")
		orderID, err := strconv.Atoi(id)
		if err != nil || orderID <= 0 {
			c.JSON(400, gin.H{"error": "รหัสคำสั่งซื้อไม่ถูกต้อง"})
			return
		}
		var input struct {
			Status string `json:"status" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
			return
		}

		updatedOrder, err := updateOrderStatus(DB, orderID, input.Status)
		if err != nil {
			var oe *orderError
			if errors.As(err, &oe) {
				c.JSON(oe.status, gin.H{"error": oe.message})
			} else {
				c.JSON(500, gin.H{"error": "อัปเดตสถานะไม่สำเร็จ"})
			}
			return
		}

		adminID, adminName := getAdminInfo(c)
		LogAdminAction(adminID, adminName, "UPDATE_ORDER_STATUS", id, fmt.Sprintf("เปลี่ยนสถานะคำสั่งซื้อเป็น %s", updatedOrder.Status))
		c.JSON(200, gin.H{"message": "เปลี่ยนสถานะคำสั่งซื้อสำเร็จ", "order": updatedOrder})
	})

	// 🔄 [NEW] Admin Expire Abandoned Pending Orders Now
	admin.POST("/orders/expire-pending", func(c *gin.Context) {
		var input struct {
			MaxAgeMinutes int `json:"max_age_minutes"`
		}
		_ = c.ShouldBindJSON(&input)
		if input.MaxAgeMinutes <= 0 {
			input.MaxAgeMinutes = 30
		}
		released, err := releaseExpiredPendingOrders(DB, time.Duration(input.MaxAgeMinutes)*time.Minute)
		if err != nil {
			c.JSON(500, gin.H{"error": "ไม่สามารถยกเลิกออเดอร์ที่หมดอายุได้"})
			return
		}
		adminID, adminName := getAdminInfo(c)
		if released > 0 {
			LogAdminAction(adminID, adminName, "EXPIRE_PENDING_ORDERS", fmt.Sprintf("%d", released), fmt.Sprintf("ยกเลิกออเดอร์ที่ค้างชำระเกิน %d นาที จำนวน %d รายการ และคืนสต็อก", input.MaxAgeMinutes, released))
		}
		c.JSON(200, gin.H{"message": "ตรวจสอบและคืนสต็อกสำเร็จ", "released_count": released})
	})

	// API เดิม: Products Management (Admin)
	admin.GET("/products/all", func(c *gin.Context) {
		var products []Product
		if err := DB.Preload("Category").Preload("Tags").Find(&products).Error; err != nil {
			c.JSON(500, gin.H{"error": "ไม่สามารถดึงข้อมูลสินค้าได้"})
			return
		}
		c.JSON(200, products)
	})

	admin.POST("/products", func(c *gin.Context) {
		// 🔧 แก้ไข: อ่าน Body ก่อนแล้วค่อย Unmarshal เพราะ ShouldBindJSON อ่าน Body ได้แค่ครั้งเดียว
		var newProducts []Product

		bodyBytes, err := c.GetRawData()
		if err != nil {
			c.JSON(400, gin.H{"error": "ไม่สามารถอ่านข้อมูลได้"})
			return
		}

		// ลอง Parse เป็น Array ก่อน
		if jsonErr := json.Unmarshal(bodyBytes, &newProducts); jsonErr != nil {
			// ถ้าไม่ใช่ Array ลอง Parse เป็น Object เดี่ยว
			var singleProduct Product
			if jsonErr2 := json.Unmarshal(bodyBytes, &singleProduct); jsonErr2 == nil {
				newProducts = append(newProducts, singleProduct)
			} else {
				c.JSON(400, gin.H{"error": "รูปแบบข้อมูลไม่ถูกต้อง"})
				return
			}
		}

		adminID, adminName := getAdminInfo(c)

		for i := range newProducts {
			p := newProducts[i] // 🔧 แก้ไข: ใช้ index แทน range value เพื่อป้องกัน pointer issue
			var existingProduct Product
			err := DB.Where("name = ?", p.Name).First(&existingProduct).Error

			if err == nil {
				existingProduct.StockQuantity += p.StockQuantity
				existingProduct.Price = p.Price
				if dbErr := DB.Save(&existingProduct).Error; dbErr != nil {
					c.JSON(500, gin.H{"error": fmt.Sprintf("อัปเดตสต็อกสินค้า %s ไม่สำเร็จ", p.Name)})
					return
				}
				LogAdminAction(adminID, adminName, "UPDATE_STOCK", fmt.Sprintf("%d", existingProduct.ID), fmt.Sprintf("เพิ่มสต็อกสินค้า %s", p.Name))
			} else {
				if dbErr := DB.Create(&p).Error; dbErr != nil {
					c.JSON(500, gin.H{"error": fmt.Sprintf("สร้างสินค้า %s ไม่สำเร็จ", p.Name)})
					return
				}
				LogAdminAction(adminID, adminName, "CREATE_PRODUCT", fmt.Sprintf("%d", p.ID), fmt.Sprintf("สร้างสินค้าใหม่ %s", p.Name))
			}
		}

		c.JSON(201, gin.H{
			"message": "ดำเนินการจัดการสต็อกสินค้าสำเร็จ",
			"count":   len(newProducts),
		})
	})

	admin.PUT("/products/:id", func(c *gin.Context) {
		id := c.Param("id")
		var product Product
		if err := DB.First(&product, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "ไม่พบสินค้าที่จะอัปเดต"})
			return
		}

		var inputData Product
		if err := c.ShouldBindJSON(&inputData); err != nil {
			c.JSON(400, gin.H{"error": "ข้อมูลที่ส่งมาไม่ถูกต้อง"})
			return
		}

		// อัปเดตข้อมูล
		product.Name = inputData.Name
		product.Description = inputData.Description
		product.Price = inputData.Price
		product.DiscountPercent = inputData.DiscountPercent
		product.StockQuantity = inputData.StockQuantity
		product.ImageUrl = inputData.ImageUrl
		product.Platform = inputData.Platform
		product.CategoryID = inputData.CategoryID

		// กรณีต้องการอัปเดต Tags (ลบของเก่าทิ้งใส่ใหม่)
		if len(inputData.Tags) > 0 {
			DB.Model(&product).Association("Tags").Replace(inputData.Tags)
		}

		if err := DB.Save(&product).Error; err != nil {
			c.JSON(500, gin.H{"error": "อัปเดตข้อมูลไม่สำเร็จ"})
			return
		}

		adminID, adminName := getAdminInfo(c)
		LogAdminAction(adminID, adminName, "UPDATE_PRODUCT", id, fmt.Sprintf("อัปเดตข้อมูลสินค้า %s", product.Name))

		c.JSON(200, gin.H{"message": "อัปเดตข้อมูลสำเร็จ", "data": product})
	})

	admin.PATCH("/products/:id/deactivate", func(c *gin.Context) {
		id := c.Param("id")
		result := DB.Model(&Product{}).Where("id = ?", id).Update("is_active", false)
		if result.Error != nil {
			c.JSON(500, gin.H{"error": "ไม่สามารถปิดการขายสินค้าได้"})
			return
		}

		adminID, adminName := getAdminInfo(c)
		LogAdminAction(adminID, adminName, "DEACTIVATE_PRODUCT", id, "ปิดการขายสินค้า")
		c.JSON(200, gin.H{"message": "ปิดการขายสินค้าสำเร็จ"})
	})

	admin.PATCH("/products/:id/activate", func(c *gin.Context) {
		id := c.Param("id")
		result := DB.Model(&Product{}).Where("id = ?", id).Update("is_active", true)
		if result.Error != nil {
			c.JSON(500, gin.H{"error": "ไม่สามารถเปิดการขายสินค้าได้"})
			return
		}

		adminID, adminName := getAdminInfo(c)
		LogAdminAction(adminID, adminName, "ACTIVATE_PRODUCT", id, "เปิดการขายสินค้า")
		c.JSON(200, gin.H{"message": "เปิดการขายสินค้าสำเร็จ"})
	})

	// 🔍 [MODIFY] Users API (Admin) พร้อม Pagination & Role Filter
	admin.GET("/users", func(c *gin.Context) {
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		if page < 1 {
			page = 1
		}
		if limit < 1 {
			limit = 10
		}
		if limit > 100 {
			limit = 100
		}
		search := strings.TrimSpace(c.Query("search"))
		roleFilter := strings.ToLower(strings.TrimSpace(c.Query("role")))

		query := DB.Model(&User{})

		if search != "" {
			query = query.Where("name ILIKE ? OR email ILIKE ?", "%"+search+"%", "%"+search+"%")
		}
		if roleFilter != "" && roleFilter != "all" {
			query = query.Where("LOWER(role) = ?", roleFilter)
		}

		var total int64
		query.Count(&total)

		var users []User
		offset := (page - 1) * limit
		if err := query.Order("id asc").Offset(offset).Limit(limit).Find(&users).Error; err != nil {
			c.JSON(500, gin.H{"error": "ไม่สามารถดึงข้อมูลผู้ใช้ได้"})
			return
		}

		c.JSON(200, gin.H{
			"data": users,
			"meta": gin.H{
				"total":       total,
				"page":        page,
				"limit":       limit,
				"total_pages": (total + int64(limit) - 1) / int64(limit),
			},
		})
	})

	admin.PUT("/users/:id/role", func(c *gin.Context) {
		roleVal, _ := c.Get("role")
		role := roleVal.(string)

		if role != "superadmin" {
			c.JSON(403, gin.H{"error": "Access Denied: สิทธิ์นี้เฉพาะ Super Admin เท่านั้น!"})
			return
		}

		adminID, adminName := getAdminInfo(c)
		targetUserID := c.Param("id")

		if fmt.Sprintf("%v", adminID) == targetUserID {
			c.JSON(400, gin.H{"error": "คุณไม่สามารถแบนหรือเปลี่ยนสิทธิ์ตัวเองได้!"})
			return
		}

		var input struct {
			Role string `json:"role" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
			return
		}
		normalizedRole := strings.ToLower(strings.TrimSpace(input.Role))
		if normalizedRole != "customer" && normalizedRole != "admin" && normalizedRole != "superadmin" {
			c.JSON(400, gin.H{"error": "รูปแบบสิทธิ์ไม่ถูกต้อง (อนุญาตเฉพาะ customer, admin, superadmin)"})
			return
		}

		if err := DB.Model(&User{}).Where("id = ?", targetUserID).Update("role", normalizedRole).Error; err != nil {
			c.JSON(500, gin.H{"error": "ไม่สามารถอัปเดตสิทธิ์ได้"})
			return
		}

		LogAdminAction(adminID, adminName, "CHANGE_USER_ROLE", targetUserID, fmt.Sprintf("เปลี่ยนสิทธิ์ผู้ใช้ ID %s เป็น %s", targetUserID, normalizedRole))
		c.JSON(200, gin.H{"message": "อัปเดตสิทธิ์เรียบร้อยแล้ว"})
	})

	admin.PUT("/users/:id/status", func(c *gin.Context) {
		adminID, adminName := getAdminInfo(c)
		targetUserID := c.Param("id")

		requesterRoleVal, _ := c.Get("role")
		requesterRole := ""
		if requesterRoleVal != nil {
			requesterRole = requesterRoleVal.(string)
		}

		var targetUser User
		if err := DB.Select("role").Where("id = ?", targetUserID).First(&targetUser).Error; err != nil {
			c.JSON(404, gin.H{"error": "ไม่พบผู้ใช้งานนี้ในระบบ"})
			return
		}

		if strings.ToLower(targetUser.Role) == "superadmin" && requesterRole != "superadmin" {
			c.JSON(403, gin.H{"error": "แอดมินทั่วไปไม่สามารถระงับการใช้งาน Super Admin ได้!"})
			return
		}

		if fmt.Sprintf("%v", adminID) == targetUserID {
			c.JSON(400, gin.H{"error": "คุณไม่สามารถแบนหรือเปลี่ยนสิทธิ์ตัวเองได้!"})
			return
		}

		var input struct {
			Status string `json:"status" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
			return
		}
		if input.Status != "Active" && input.Status != "Banned" && input.Status != "Suspended" {
			c.JSON(400, gin.H{"error": "สถานะผู้ใช้งานไม่ถูกต้อง"})
			return
		}

		if err := DB.Model(&User{}).Where("id = ?", targetUserID).Update("status", input.Status).Error; err != nil {
			c.JSON(500, gin.H{"error": "ไม่สามารถเปลี่ยนสถานะได้"})
			return
		}

		actionName := "BAN_USER"
		if input.Status == "Active" {
			actionName = "UNBAN_USER"
		}

		LogAdminAction(adminID, adminName, actionName, targetUserID, fmt.Sprintf("เปลี่ยนสถานะผู้ใช้ ID %s เป็น %s", targetUserID, input.Status))
		c.JSON(200, gin.H{"message": "เปลี่ยนสถานะผู้ใช้งานเรียบร้อยแล้ว"})
	})

	admin.GET("/admin-logs", func(c *gin.Context) {
		var logs []AdminLog

		roleVal, _ := c.Get("role")
		role := roleVal.(string)

		if role != "superadmin" {
			c.JSON(403, gin.H{"error": "Access Denied: สิทธิ์นี้เฉพาะ Super Admin เท่านั้น!"})
			return
		}

		if err := DB.Order("created_at desc").Find(&logs).Error; err != nil {
			c.JSON(500, gin.H{"error": "ไม่สามารถดึงข้อมูลประวัติการทำงานได้"})
			return
		}

		c.JSON(200, logs)
	})

	// ==========================================
	// 🚀 4. Start Server
	// ==========================================
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Println("🚀 Server is running on port", port)
	r.Run(":" + port)
}
