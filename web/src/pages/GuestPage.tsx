import { useCallback, useEffect, useState } from 'react';
import { guestApi, ApiError } from '../api/client';
import type { CreateBookingRequest, EventType, TimeSlot } from '../api/types';
import { formatDateTime, formatTime } from '../lib/format';
import DatePicker from '../components/DatePicker';

type Step = 'types' | 'slots' | 'form' | 'done';

export default function GuestPage() {
  const [types, setTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('types');
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
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

  const selectType = (type: EventType) => {
    setSelectedType(type);
    setStep('slots');
    setError(null);
  };

  const pickSlot = (slot: TimeSlot) => {
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

      {/* Шаг 2: выбор даты и времени */}
      {step === 'slots' && selectedType && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="btn" onClick={() => setStep('types')}>
              ← Назад
            </button>
            <h3 style={{ margin: 0 }}>{selectedType.title}</h3>
          </div>
          <DatePicker
            eventTypeId={selectedType.id}
            durationMinutes={selectedType.durationMinutes}
            onSlotSelected={pickSlot}
          />
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