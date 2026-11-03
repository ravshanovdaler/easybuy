export type Lang = 'ru' | 'uz' | 'en';

export const translations: Record<string, Record<Lang, string>> = {
  // Navigation
  nav_home: { ru: 'Главная', uz: 'Bosh sahifa', en: 'Home' },
  nav_cart: { ru: 'Корзина', uz: 'Savat', en: 'Cart' },
  nav_orders: { ru: 'Заказы', uz: 'Buyurtmalar', en: 'Orders' },
  nav_settings: { ru: 'Настройки', uz: 'Sozlamalar', en: 'Settings' },

  // Home Page
  how_it_works: { ru: 'Как это работает ❓', uz: 'Qanday ishlaydi ❓', en: 'How it works ❓' },
  search_placeholder: { ru: 'Поиск товаров из Китая...', uz: 'Xitoy tovarlarini qidirish...', en: 'Search products from China...' },
  all_categories: { ru: 'Все', uz: 'Barchasi', en: 'All' },
  no_products: { ru: 'Товары не найдены', uz: 'Mahsulotlar topilmadi', en: 'No products found' },
  try_another_search: { ru: 'Попробуйте другой запрос или категорию', uz: 'Boshqa so\'rov yoki toifani sinab ko\'ring', en: 'Try another search or category' },
  backend_not_connected: { ru: 'Сервер временно недоступен', uz: 'Server vaqtincha ishlamayapti', en: 'Backend Not Connected' },

  // Product Page
  back: { ru: '← Назад', uz: '← Orqaga', en: '← Back' },
  shipping: { ru: 'доставка', uz: 'yetkazib berish', en: 'shipping' },
  description: { ru: 'Описание товара', uz: 'Mahsulot tavsifi', en: 'Product Description' },
  add_to_cart: { ru: 'Добавить в корзину', uz: 'Savatga qo\'shish', en: 'Add to Cart' },
  added_to_cart: { ru: 'Товар добавлен в корзину!', uz: 'Mahsulot savatga qo\'shildi!', en: 'Added to cart!' },
  failed_add_cart: { ru: 'Не удалось добавить в корзину', uz: 'Savatga qo\'shib bo\'lmadi', en: 'Failed to add to cart' },

  // Cart Page
  cart_title: { ru: '🛒 Корзина', uz: '🛒 Savat', en: '🛒 Cart' },
  empty_cart: { ru: 'Ваша корзина пуста', uz: 'Savatingiz bo\'sh', en: 'Your cart is empty' },
  browse_catalog: { ru: 'Перейти в каталог', uz: 'Katalogga o\'tish', en: 'Browse Products' },
  clear_cart: { ru: 'Очистить', uz: 'Tozalash', en: 'Clear' },
  subtotal: { ru: 'Товары:', uz: 'Mahsulotlar:', en: 'Subtotal:' },
  service_fee: { ru: 'Комиссия сервиса:', uz: 'Xizmat haqi:', en: 'Service fee:' },
  shipping_fee: { ru: 'Доставка:', uz: 'Yetkazib berish:', en: 'Shipping:' },
  total: { ru: 'Итого к оплате:', uz: 'Jami to\'lov:', en: 'Total:' },
  checkout: { ru: 'Оформить заказ', uz: 'Buyurtma berish', en: 'Checkout' },
  select_address: { ru: 'Адрес доставки', uz: 'Yetkazib berish manzili', en: 'Delivery Address' },
  add_address_first: { ru: 'Сначала добавьте адрес в Настройках', uz: 'Avval Sozlamalarda manzil qo\'shing', en: 'Add an address in Settings first' },
  select_payment_method: { ru: 'Способ оплаты', uz: 'To\'lov usuli', en: 'Payment Method' },
  confirm_order: { ru: 'Подтвердить и заказать', uz: 'Buyurtmani tasdiqlash', en: 'Confirm Order' },

  // Orders / History
  orders_title: { ru: '📦 История заказов', uz: '📦 Buyurtmalar tarixi', en: '📦 Order History' },
  no_orders: { ru: 'У вас пока нет заказов', uz: 'Sizda hali buyurtmalar yo\'q', en: 'No orders yet' },
  order_num: { ru: 'Заказ #', uz: 'Buyurtma #', en: 'Order #' },
  view_details: { ru: 'Подробнее', uz: 'Batafsil', en: 'View Details' },

  // Statuses
  status_pending_payment: { ru: 'Ожидает оплаты', uz: 'To\'lov kutilmoqda', en: 'Pending Payment' },
  status_payment_review: { ru: 'Чек на проверке', uz: 'To\'lov tekshirilmoqda', en: 'Payment Under Review' },
  status_approved: { ru: 'Оплачен / Подтвержден', uz: 'To\'langan / Tasdiqlangan', en: 'Approved' },
  status_purchasing: { ru: 'Выкупается в Китае', uz: 'Xitoyda sotib olinmoqda', en: 'Purchasing in China' },
  status_warehouse: { ru: 'На складе в Китае', uz: 'Xitoy omborida', en: 'In China Warehouse' },
  status_shipping: { ru: 'В пути в Узбекистан', uz: 'O\'zbekistonga yo\'lda', en: 'In Transit' },
  status_delivered: { ru: 'Доставлен', uz: 'Yetkazib berildi', en: 'Delivered' },
  status_cancelled: { ru: 'Отменен', uz: 'Bekor qilingan', en: 'Cancelled' },
  status_payment_rejected: { ru: 'Оплата отклонена', uz: 'To\'lov rad etildi', en: 'Payment Rejected' },

  // Settings Page
  settings_title: { ru: '⚙️ Настройки', uz: '⚙️ Sozlamalar', en: '⚙️ Settings' },
  profile: { ru: 'Профиль', uz: 'Profil', en: 'Profile' },
  language: { ru: 'Язык приложения', uz: 'Ilova tili', en: 'Application Language' },
  lang_ru: { ru: '🇷🇺 Русский', uz: '🇷🇺 Ruscha', en: '🇷🇺 Russian' },
  lang_uz: { ru: '🇺🇿 O\'zbek', uz: '🇺🇿 O\'zbekcha', en: '🇺🇿 Uzbek' },
  lang_en: { ru: '🇬🇧 English', uz: '🇬🇧 Inglizcha', en: '🇬🇧 English' },
  delivery_addresses: { ru: 'Адреса доставки', uz: 'Yetkazib berish manzillari', en: 'Delivery Addresses' },
  add_address: { ru: '+ Добавить адрес', uz: '+ Manzil qo\'shish', en: '+ Add Address' },
  recipient: { ru: 'Получатель (ФИО)', uz: 'Qabul qiluvchi (FIO)', en: 'Recipient (Full Name)' },
  phone: { ru: 'Номер телефона', uz: 'Telefon raqam', en: 'Phone Number' },
  city: { ru: 'Город / Область', uz: 'Shahar / Viloyat', en: 'City / Region' },
  street: { ru: 'Улица, дом, квартира', uz: 'Ko\'cha, uy, xonadon', en: 'Street & Apartment' },
  postal_code: { ru: 'Почтовый индекс', uz: 'Pochta indeksi', en: 'Postal Code' },
  default_addr: { ru: 'Основной адрес', uz: 'Asosiy manzil', en: 'Default' },
  delete: { ru: 'Удалить', uz: 'O\'chirish', en: 'Delete' },
  save: { ru: 'Сохранить', uz: 'Saqlash', en: 'Save' },
  cancel: { ru: 'Отмена', uz: 'Bekor qilish', en: 'Cancel' },

  // Payment Page
  payment_page_title: { ru: '💳 Оплата заказа', uz: '💳 Buyurtma to\'lovi', en: '💳 Order Payment' },
  payment_instructions: { ru: 'Инструкция по оплате', uz: 'To\'lov yo\'riqnomasi', en: 'Payment Instructions' },
  upload_receipt: { ru: 'Загрузить чек об оплате', uz: 'To\'lov chekini yuklash', en: 'Upload Payment Receipt' },
  select_receipt_file: { ru: 'Выберите файл или скриншот чека', uz: 'Chek fayli yoki skrinshotni tanlang', en: 'Select receipt screenshot' },
  submit_receipt: { ru: 'Отправить чек на проверку', uz: 'Chekni tekshirishga yuborish', en: 'Submit Receipt for Review' },
  receipt_submitted: { ru: 'Чек успешно отправлен! Ожидайте подтверждения.', uz: 'Chek muvaffaqiyatli yuborildi! Tasdiqlashni kuting.', en: 'Receipt submitted! Awaiting confirmation.' },
  support_help: { ru: 'Поддержка в Telegram', uz: 'Telegram orqali yordam', en: 'Telegram Support' },
};

