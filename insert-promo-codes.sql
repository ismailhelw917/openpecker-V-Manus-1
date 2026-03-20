INSERT INTO promo_codes (id, code, benefitType, discountPercent, description, maxUses, currentUses, isActive, createdAt)
VALUES 
  (UUID(), 'openpecker50', 'free_premium', 100, 'Get instant premium access for free', 100, 0, 1, NOW()),
  (UUID(), 'openpecker80', 'discount', 80, 'Get 80% off premium access - limited to first 400 users', 400, 0, 1, NOW());
