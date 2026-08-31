import { useCallback, useEffect, useState } from 'react';
import { guestApi, ApiError } from '../api/client';
import type { CreateBookingRequest, EventType, TimeSlot } from '../api/types';
import { formatDateTime, formatTime, inTwoWeeksISO, todayISO } from '../lib/format';

type Step = 'types' | 'slots' | 'form' | 'done';

export default function GuestPage() {
  const [types, setTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('types');
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Поля формы бронирования.
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ id: string; startTime: string } | null>(null);

  const loadTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTypes(await guestApi.listEventTypes());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить типы событий');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const selectType = async (type: EventType) => {
    setSelectedType(type);
    setStep('slots');
    setSlots([]);
    setError(null);
    try {
      setSlots(await guestApi.getAvailableSlots(type.id, todayISO(), inTwoWeeksISO()));
    } catch (e) {
      setSelectedType(null);
      setStep('types');
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить слоты');
    }
  };

  const pickSlot = (slot: TimeSlot) => {
    if (!slot.isAvailable) return;
    setSelectedSlot(slot);
    setStep('form');
  };

  const submitBooking = async () => {
    if (!selectedType || !selectedSlot) return;
    setSubmitError(null);
    const req: CreateBookingRequest = {
      eventTypeId: selectedType.id,
      guestName,
      guestEmail: guestEmail || undefined,
      startTime: selectedSlot.startTime,
    };
    try {
      const result = await guestApi.createBooking(req);
      setBooking({ id: result.id, startTime: result.startTime });
      setStep('done');
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : 'Не удалось создать бронирование');
    }
  };

  const reset = () => {
    setStep('types');
    setSelectedType(null);
    setSelectedSlot(null);
    setSlots([]);
    setGuestName('');
    setGuestEmail('');
    setBooking(null);
    setSubmitError(null);
    void loadTypes();
  };

  if (loading && types.length === 0) {
    return <div className="empty">Загрузка…</div>;
  }

  if (step === 'types' && (error || types.length === 0)) {
    return (
      <div>
        {error && <div className="err">{error}</div>}
        <div className="empty">
          Типы событий пока недоступны.
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => void loadTypes()}>
              Обновить
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Запись на встречу</h2>

      {/* Шаг 1: список типов событий */}
      {step === 'types' && (
        <>
          {error && <div className="err">{error}</div>}
          <div className="grid grid-2">
            {types.map((t) => (
              <div className="card" key={t.id}>
                <h3>{t.title}</h3>
                {t.description && <p className="muted">{t.description}</p>}
                <p className="muted">Длительность: {t.durationMinutes} мин</p>
                <button className="btn primary" onClick={() => void selectType(t)}>
                  Выбрать
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Шаг 2: свободные слоты */}
      {step === 'slots' && selectedType && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="btn" onClick={() => setStep('types')}>
              ← Назад
            </button>
            <h3 style={{ margin: 0 }}>{selectedType.title}</h3>
          </div>
          {slots.length === 0 ? (
            <div className="empty">Свободных слотов в ближайшие 14 дней нет.</div>
          ) : (
            <>
              <p className="muted">Выберите свободный слот (окно 14 дней):</p>
              <div className="grid grid-2">
                {slots
                  .filter((s) => s.isAvailable)
                  .map((s) => (
                    <button
                      key={s.startTime}
                      className="btn"
                      style={{ textAlign: 'left', padding: '12px' }}
                      onClick={() => pickSlot(s)}
                    >
                      <div>
                        {formatDateTime(s.startTime)} — {formatTime(s.endTime)}
                      </div>
                    </button>
                  ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Шаг 3: форма бронирования */}
      {step === 'form' && selectedType && selectedSlot && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="btn" onClick={() => setStep('slots')}>
              ← Назад
            </button>
            <h3 style={{ margin: 0 }}>{selectedType.title}</h3>
          </div>
          <div className="card">
            <p>
              <strong>Время:</strong> {formatDateTime(selectedSlot.startTime)} —{' '}
              {formatTime(selectedSlot.endTime)}
            </p>
            {submitError && <div className="err">{submitError}</div>}
            <div className="field">
              <label htmlFor="guestName">Ваше имя *</label>
              <input
                id="guestName"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="guestEmail">Email (необязательно)</label>
              <input
                id="guestEmail"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
              />
            </div>
            <button
              className="btn primary"
              disabled={!guestName.trim()}
              onClick={() => void submitBooking()}
            >
              Подтвердить бронирование
            </button>
          </div>
        </>
      )}

      {/* Шаг 4: подтверждение */}
      {step === 'done' && booking && (
        <div className="card">
          <h3>Бронирование подтверждено 🎉</h3>
          <p>
            Номер брони: <strong>{booking.id}</strong>
          </p>
          <p>Время: {formatDateTime(booking.startTime)}</p>
          <button className="btn primary" onClick={reset}>
            Записаться ещё
          </button>
        </div>
      )}
    </div>
  );
}