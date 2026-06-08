import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { CENTER } from '../config'
import OnboardingModal from '../components/OnboardingModal'
import TeacherOnboardingModal from '../components/TeacherOnboardingModal'
import CabinetPreview from '../components/CabinetPreview'
import styles from './Landing.module.css'

const courses = [
  {
    id: 1,
    title: 'Подготовка к SAT Math',
    rating: '4.9',
    reviews: '450+ отзывов',
    price: 'От 600к',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB8x5uMiLOrGIDiXQiaHeqdSzOcLoUw-txdlfmWQhV_fd5OEhy5Sm1wjxedYowT1EDBEsgXC5tr_olCJros93yapLvpsFAVwZdF8jHHGDbShlAoKBI_9xyXshjSe39mPUAoq0yF6F6wHNEQm89rJQ4gBS90HMU9tACZnIocfpa-gZPBgthNQWJq1ANOhnlK6ICF2iQlF9k6mG4oOs9r_YExR0S7wt2dnJ6Kt-FCuVE_KOtUWoW05gYdvCYwJNCAvRX6btire7StaAA',
    badge: 'Популярно',
  },
  {
    id: 2,
    title: 'Олимпиадная Математика',
    rating: '4.8',
    reviews: '210',
    price: 'От 550к',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD7FdDtDAiwvwGdWoitg2m2FAyd_j_zwYjbAaSDPSaGB-6hl27xzQ4m2CZJjpVGxM2crBzCmUZ2StDKDur7qiSGaEE69W9h_uEnYr1pMqBh-hUw6C8T8Z3oexWtEeeTFVV1cdRGqa26fxHMh35tlyet3rT2BY6LR880W3JCuKSjKTcmqk_X_UUGBFeppThU-6opQT1KyCGQ2uX-Hize2EhPTfDuRPkSwRksmmr3Y8uIH620DzHyg7_iT1cs5vReb47NDcDphhNYPwI',
    badge: null,
  },
  {
    id: 3,
    title: 'Курсы для Абитуриентов',
    rating: '5.0',
    reviews: '150',
    price: 'От 500к',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDqi_DpGqV00n1Jg-z4nQe5DVIQ4BKsa5wW5NZiR5_maDnyRSk9_BSmse8ZAg5p_440LcNRbu74kZcc6SqllZXt3gUgSGvlj3ygyowNTADl1U3gaT17ACx-3WyMFNvbBi69CsGNyGDPZ33dmd6e0kxErRhgnA4sTcwqG_VlUiB3eOOPUvpcinC59e39KWk8RxrI4cgu4HWZC9kS9-c-1cThPjaBPopdtgsu8snEPnKY4SinT306nK51yfuvbd80R3qbbHxXahv7O_c',
    badge: null,
  },
]

const features = [
  {
    icon: 'apartment',
    title: 'Современные Кампусы',
    description: 'Удобные локации в центре города Ташкент.',
  },
  {
    icon: 'groups',
    title: 'Опытные Наставники',
    description: 'Индивидуальный подход к каждому ученику.',
  },
  {
    icon: 'workspace_premium',
    title: 'Сертификация',
    description: 'Официальные сертификаты об окончании курсов.',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const { user, loading: userLoading } = useUser()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showTeacherOnboarding, setShowTeacherOnboarding] = useState(false)

  // Block scroll when modal is open
  useEffect(() => {
    if (showOnboarding || showTeacherOnboarding) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showOnboarding, showTeacherOnboarding])

  const handleCabinetClick = () => {
    // If user data is still loading, do nothing
    if (userLoading) return

    // User loaded but not onboarded — show appropriate onboarding
    if (!user || !user.onboarded) {
      if (user && (user.role === 'teacher' || user.role === 'admin')) {
        setShowTeacherOnboarding(true)
      } else {
        setShowOnboarding(true)
      }
    } else {
      // Already onboarded — go to dashboard
      navigate('/dashboard')
    }
  }

  return (
    <div className={`${styles.page} ${showOnboarding || showTeacherOnboarding ? styles.pageHidden : ''}`}>
      {/* Show blurred CabinetPreview when onboarding modal is open */}
      {(showOnboarding || showTeacherOnboarding) && (
        <div className={styles.cabinetPreviewWrapper}>
          <CabinetPreview />
        </div>
      )}
      {/* TopAppBar */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button className={styles.headerButton}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>function</span>
          </button>
          <h1 className={styles.headerTitle}>{CENTER.name}</h1>
          <button className={styles.headerButton}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)' }}>account_circle</span>
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.heroCard}>
            <div className={styles.heroDecorTopRight} />
            <div className={styles.heroDecorBottomLeft} />
            <div className={styles.heroContent}>
              <h2 className={styles.heroTitle}>Раскрой свой потенциал в {CENTER.name}</h2>
              <p className={styles.heroSubtitle}>
                Офлайн и онлайн занятия в Узбекистане с экспертами для вашего карьерного роста и успеха.
              </p>
              <div className={styles.heroButtons}>
                <button className={styles.heroButtonPrimary}>
                  Записаться на пробный урок
                </button>
                <button className={styles.heroButtonGlass} onClick={handleCabinetClick}>
                  Вход в личный кабинет
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Row */}
        <section className={styles.statsSection}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>3+</span>
            <span className={styles.statLabel}>Филиала</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>1.5k+</span>
            <span className={styles.statLabel}>Учеников</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>25+</span>
            <span className={styles.statLabel}>Репетиторов</span>
          </div>
        </section>

        {/* Featured Courses */}
        <section className={styles.coursesSection}>
          <div className={styles.coursesHeader}>
            <h3 className={styles.sectionTitle}>Наши Направления</h3>
            <button className={styles.seeAllButton}>Все курсы</button>
          </div>
          <div className={styles.coursesScroll}>
            {courses.map((course) => (
              <div key={course.id} className={styles.courseCard}>
                <div className={styles.courseImageWrapper}>
                  <img
                    src={course.image}
                    alt={course.title}
                    className={styles.courseImage}
                  />
                  {course.badge && (
                    <span className={styles.courseBadge}>{course.badge}</span>
                  )}
                </div>
                <div className={styles.courseContent}>
                  <div className={styles.courseRating}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#f59e0b', fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className={styles.ratingText}>
                      {course.rating} ({course.reviews})
                    </span>
                  </div>
                  <h4 className={styles.courseTitle}>{course.title}</h4>
                  <div className={styles.courseFooter}>
                    <span className={styles.coursePrice}>{course.price}</span>
                    <button className={styles.calendarButton}>
                      <span className="material-symbols-outlined">calendar_today</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Why Us */}
        <section className={styles.featuresSection}>
          <h3 className={styles.sectionTitle}>Почему {CENTER.name}?</h3>
          <div className={styles.featuresList}>
            {features.map((feature, index) => (
              <div key={index} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <span className="material-symbols-outlined">{feature.icon}</span>
                </div>
                <div className={styles.featureText}>
                  <h4 className={styles.featureTitle}>{feature.title}</h4>
                  <p className={styles.featureDescription}>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className={styles.ctaSection}>
          <div className={styles.ctaCard}>
            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-primary)' }}>rocket_launch</span>
            <button className={styles.ctaButton} onClick={handleCabinetClick}>
              Войти в личный кабинет
            </button>
          </div>
        </section>
      </main>

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => {
          setShowOnboarding(false)
          navigate('/dashboard')
        }}
      />

      {/* Teacher Onboarding Modal */}
      <TeacherOnboardingModal
        isOpen={showTeacherOnboarding}
        onClose={() => {
          setShowTeacherOnboarding(false)
          navigate('/dashboard')
        }}
      />
    </div>
  )
}
