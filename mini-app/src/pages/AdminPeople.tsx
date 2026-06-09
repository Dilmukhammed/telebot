import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAdminUsers, useCreateAdminUser } from '../api/hooks'
import type { UserOut } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import styles from './AdminPeople.module.css'

type Tab = 'students' | 'teachers'

export default function AdminPeople() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'teachers' ? 'teachers' : 'students'
  const [tab, setTab] = useState<Tab>(initialTab)
  const role = tab === 'students' ? 'student' : 'teacher'
  const { data: users = [], isLoading } = useAdminUsers(role)
  const createMutation = useCreateAdminUser()
  const [searchQuery, setSearchQuery] = useState('')

  // Create teacher modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ first_name: '', last_name: '', username: '', phone: '' })
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

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

  const handleCreateTeacher = async () => {
    if (!createForm.first_name || !createForm.last_name || !createForm.username || !createForm.phone) {
      setCreateError('Заполните все поля')
      return
    }

    setCreateLoading(true)
    setCreateError(null)
    try {
      await createMutation.mutateAsync(createForm)
      setShowCreateModal(false)
      setCreateForm({ first_name: '', last_name: '', username: '', phone: '' })
    } catch (err: any) {
      setCreateError(err?.message || 'Ошибка создания')
    } finally {
      setCreateLoading(false)
    }
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
        {isLoading ? (
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

      {/* FAB - Add Teacher */}
      {tab === 'teachers' && (
        <button
          className={styles.fab}
          onClick={() => setShowCreateModal(true)}
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      )}

      {/* Create Teacher Modal */}
      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Новый преподаватель</h3>
              <button className={styles.modalClose} onClick={() => setShowCreateModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className={styles.modalBody}>
              {createError && (
                <div className={styles.modalError}>{createError}</div>
              )}

              <div className={styles.formGroup}>
                <label>Имя *</label>
                <input
                  type="text"
                  placeholder="Имя"
                  value={createForm.first_name}
                  onChange={e => setCreateForm({ ...createForm, first_name: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Фамилия *</label>
                <input
                  type="text"
                  placeholder="Фамилия"
                  value={createForm.last_name}
                  onChange={e => setCreateForm({ ...createForm, last_name: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Username *</label>
                <div className={styles.usernameInput}>
                  <span className={styles.atSign}>@</span>
                  <input
                    type="text"
                    placeholder="username"
                    value={createForm.username}
                    onChange={e => setCreateForm({ ...createForm, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Телефон *</label>
                <input
                  type="tel"
                  placeholder="+998 XX XXX XX XX"
                  value={createForm.phone}
                  onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowCreateModal(false)}
              >
                Отмена
              </button>
              <button
                className={styles.createBtn}
                onClick={handleCreateTeacher}
                disabled={createLoading}
              >
                {createLoading ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
