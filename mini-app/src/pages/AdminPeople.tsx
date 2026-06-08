import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAdminUsers } from '../api/client'
import type { UserOut } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import styles from './AdminPeople.module.css'

type Tab = 'students' | 'teachers'

export default function AdminPeople() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'teachers' ? 'teachers' : 'students'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [users, setUsers] = useState<UserOut[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setLoading(true)
    getAdminUsers({ role: tab === 'students' ? 'student' : 'teacher' })
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [tab])

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true
    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase()
    const username = (u.username || '').toLowerCase()
    const phone = (u.phone || '').toLowerCase()
    const query = searchQuery.toLowerCase()
    return fullName.includes(query) || username.includes(query) || phone.includes(query)
  })

  const getInitials = (u: UserOut) => {
    if (u.first_name) return u.first_name[0].toUpperCase()
    if (u.username) return u.username[0].toUpperCase()
    return '?'
  }

  return (
    <div className={styles.page}>
      <SiteHeader title="Люди" onBack={() => navigate('/dashboard')} hideProfile />

      <main className={styles.main}>
        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'students' ? styles.activeTab : ''}`}
            onClick={() => { setTab('students'); setSearchQuery('') }}
          >
            Ученики
          </button>
          <button
            className={`${styles.tab} ${tab === 'teachers' ? styles.activeTab : ''}`}
            onClick={() => { setTab('teachers'); setSearchQuery('') }}
          >
            Преподаватели
          </button>
        </div>

        {/* Search */}
        <div className={styles.searchBox}>
          <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
          <input
            type="text"
            placeholder="Поиск по имени или телефону..."
            className={styles.searchInput}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className={styles.clearBtn} onClick={() => setSearchQuery('')}>
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : filteredUsers.length === 0 ? (
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>
              {searchQuery ? 'search_off' : 'group'}
            </span>
            <p>{searchQuery ? 'Никого не найдено' : 'Нет пользователей'}</p>
          </div>
        ) : (
          <>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                {tab === 'students' ? 'Ученики' : 'Преподаватели'}
              </h2>
              <span className={styles.countBadge}>{filteredUsers.length}</span>
            </div>
            <div className={styles.list}>
              {filteredUsers.map(u => (
                <button
                  key={u.id}
                  className={styles.card}
                  onClick={() => navigate(`/admin/people/${u.id}`)}
                >
                  <div className={styles.avatar}>
                    {u.photo_url ? (
                      <img src={u.photo_url} alt="" className={styles.avatarImg} />
                    ) : (
                      getInitials(u)
                    )}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.nameRow}>
                      <span className={styles.name}>
                        {u.first_name || u.username || 'Без имени'} {u.last_name || ''}
                      </span>
                      {!u.onboarded && (
                        <span className={styles.pendingBadge}>Новый</span>
                      )}
                      {!u.is_active && (
                        <span className={styles.inactiveBadge}>Блок</span>
                      )}
                    </div>
                    <div className={styles.meta}>
                      {u.username && <span className={styles.metaPill}>@{u.username}</span>}
                      {u.phone && <span className={styles.metaPill}>{u.phone}</span>}
                      {tab === 'students' && u.grade && (
                        <span className={styles.metaPill}>{u.grade} кл.</span>
                      )}
                    </div>
                  </div>
                  <span className={`material-symbols-outlined ${styles.chevron}`}>chevron_right</span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
