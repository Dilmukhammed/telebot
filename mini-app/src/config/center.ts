// Center Configuration
// Change all center info in this one place

export const CENTER = {
  // Basic info
  name: 'EduCenter',
  fullName: {
    ru: 'Учебный центр EduCenter',
    en: 'EduCenter Learning Center',
    uz: 'EduCenter o\'quv markazi',
  },

  // Contacts
  phone: '+998 90 123 45 67',
  phoneRaw: '+998901234567', // For tel: links

  // Telegram
  telegramUsername: 'educenter_support',
  telegramUrl: 'https://t.me/educenter_support',

  // Address
  address: {
    ru: 'г. Ташкент',
    en: 'Tashkent',
    uz: 'Toshkent',
  },
  addressFull: {
    ru: 'г. Ташкент, ул. Амира Темура, 15',
    en: 'Tashkent, Amir Temur 15',
    uz: 'Toshkent, Amir Temur 15',
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
