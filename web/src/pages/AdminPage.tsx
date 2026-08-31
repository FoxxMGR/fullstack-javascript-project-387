import { useCallback, useEffect, useState } from 'react';
import { adminApi, ApiError } from '../api/client';
import type { Booking, CreateEventTypeRequest, EventType } from '../api/types';
import { formatDateTime } from '../lib/format';

type Tab = 'types' | 'bookings';

const EMPTY_FORM: CreateEventTypeRequest = {
  title: '',
  description: '',
  durationMinutes: 30,
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('types');

  // Типы событий.
  const [types, setTypes] = useState<EventType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [form, setForm] = useState<CreateEventTypeRequest>(EMPTY_FORM);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Бронирования.
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState<'upcoming' | 'past'>('upcoming');
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  const loadTypes = useCallback(async () => {
    setLoadingTypes(true);
    setTypesError(null);
    try {
      setTypes(await adminApi.listEventTypes());
    } catch (e) {
      setTypesError(e instanceof ApiError ? e.message : 'Не удалось загрузить типы событий');
    } finally {
      setLoadingTypes(false);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    setLoadingBookings(true);
    setBookingsError(null);
    try {
      setBookings(await adminApi.listBookings(status));
    } catch (e) {
      setBookingsError(e instanceof ApiError ? e.message : 'Не удалось загрузить бронирования');
    } finally {
      setLoadingBookings(false);
    }
  }, [status]);

  useEffect(() => {
    void loadTypes();
    void loadBookings();
  }, [loadTypes, loadBookings]);

  const submitForm = async () => {
    if (!form.title.trim()) {
      setFormError('Укажите название типа события');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await adminApi.createEventType(form);
      setForm(EMPTY_FORM);
      await loadTypes();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Не удалось сохранить тип события');
    } finally {
      setSaving(false);
    }
  };

  const cancelBooking = async (id: string) => {
    if (!window.confirm('Отменить это бронирование?')) {
      return;
    }
    try {
      await adminApi.cancelBooking(id);
      await loadBookings();
    } catch (e) {
      setBookingsError(e instanceof ApiError ? e.message : 'Не удалось отменить бронирование');
    }
  };

  const typeTitle = (id: string) => types.find((t) => t.id === id)?.title ?? id;

  return (
    <div>
      <h2>Панель владельца</h2>
      <div className="nav" style={{ marginBottom: 16 }}>
        <button
          className={tab === 'types' ? 'active' : ''}
          onClick={() => setTab('types')}
        >
          Типы событий
        </button>
        <button
          className={tab === 'bookings' ? 'active' : ''}
          onClick={() => setTab('bookings')}
        >
          Бронирования
        </button>
      </div>

      {tab === 'types' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Форма создания типа события */}
          <div>
            <h3>Создать тип события</h3>
            <div className="card">
              {formError && <div className="err">{formError}</div>}
              <div className="field">
                <label htmlFor="title">Название *</label>
                <input
                  id="title"
                  value={form.title}
                  maxLength={100}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="description">Описание</label>
                <textarea
                  id="description"
                  rows={3}
                  maxLength={500}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="duration">Длительность (минут)</label>
                <input
                  id="duration"
                  type="number"
                  min={5}
                  max={480}
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm({ ...form, durationMinutes: Number(e.target.value) })
                  }
                />
              </div>
              <div className="row">
                <button
                  className="btn primary"
                  disabled={saving || !form.title.trim()}
                  onClick={() => void submitForm()}
                >
                  {saving ? 'Создание…' : 'Создать'}
                </button>
              </div>
            </div>
          </div>

          {/* Список типов событий */}
          <div>
            <h3>Типы событий</h3>
            {typesError && <div className="err">{typesError}</div>}
            {loadingTypes ? (
              <div className="empty">Загрузка…</div>
            ) : types.length === 0 ? (
              <div className="empty">Типов событий пока нет.</div>
            ) : (
              types.map((t) => (
                <div className="card" key={t.id}>
                  <div>
                    <h3 style={{ margin: 0 }}>{t.title}</h3>
                    {t.description && <p className="muted">{t.description}</p>}
                    <span className="muted">{t.durationMinutes} мин</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'bookings' && (
        <div>
          <div className="row" style={{ marginBottom: 16 }}>
            <button
              className={`btn ${status === 'upcoming' ? 'primary' : ''}`}
              onClick={() => setStatus('upcoming')}
            >
              Предстоящие
            </button>
            <button
              className={`btn ${status === 'past' ? 'primary' : ''}`}
              onClick={() => setStatus('past')}
            >
              Прошедшие
            </button>
          </div>
          {bookingsError && <div className="err">{bookingsError}</div>}
          {loadingBookings ? (
            <div className="empty">Загрузка…</div>
          ) : bookings.length === 0 ? (
            <div className="empty">Нет бронирований.</div>
          ) : (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Тип события</th>
                    <th>Гость</th>
                    <th>Время</th>
                    <th>Email</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td>{typeTitle(b.eventTypeId)}</td>
                      <td>{b.guestName}</td>
                      <td>{formatDateTime(b.startTime)}</td>
                      <td>{b.guestEmail ?? '—'}</td>
                      <td>
                        {status === 'upcoming' && (
                          <button
                            className="btn danger"
                            onClick={() => void cancelBooking(b.id)}
                          >
                            Отменить
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}