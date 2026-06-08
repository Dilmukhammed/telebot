// ZuhraMath Center Configuration
// Change all center info in this one place

export const CENTER = {
  // Basic info
  name: 'ZuhraMath',
  fullName: {
    ru: 'Учебный центр ZuhraMath',
    en: 'ZuhraMath Learning Center',
    uz: 'ZuhraMath o\'quv markazi',
  },
  
  // Contacts
  phone: '+998 50 870 31 98',
  phoneRaw: '+998508703198', // For tel: links
  
  // Telegram
  telegramUsername: 'ZUHRAMATH',
  telegramUrl: 'https://t.me/ZUHRAMATH',
  
  // Address
  address: {
    ru: 'г. Ташкент',
    en: 'Tashkent',
    uz: 'Toshkent',
  },
  addressFull: {
    ru: 'г. Ташкент, ул. Фидокор, 7А',
    en: 'Tashkent, Fidokor 7A',
    uz: 'Toshkent, Fidokor 7A',
  },
  
  // Social / Website
  website: '',
  instagram: '',
  
  // Support
  supportHours: {
    ru: 'Пн-Сб, 9:00-18:00',
    en: 'Mon-Sat, 9:00-18:00',
    uz: 'Du-Sha, 9:00-18:00',
  },
  
  // Schedule
  timezone: 'Asia/Tashkent',
  timezoneOffset: 5, // UTC+5
} as const

// Type for the config
export type CenterConfig = typeof CENTER

// Helper to get translated value
export function getLocalized<T extends Record<string, string>>(obj: T, lang: string): string {
  return obj[lang as keyof T] || obj.ru || ''
}
