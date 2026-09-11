import { useCallback, useEffect, useState } from 'react';
import { guestApi, ApiError } from '../api/client';
import type { CreateBookingRequest, EventType, TimeSlot } from '../api/types';
import DateTimePicker from '../components/DateTimePicker';

type Step = 'types' | 'picker' | 'form' | 'done';

export default function GuestPage() {
  const [types, setTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('types');
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

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

      {step === 'types' && (
        <>
          {error && <div className="err">{error}</div>}
          <div className="grid grid-2">
            {types.map((t) => (
              <div className="card" key={t.id}>
                <h3>{t.title}</h3>
                {t.description && <p className="muted">{t.description}</p>}
                <p className="muted">Длительность: {t.durationMinutes} мин</p>
                <button className="btn primary" onClick={() => {
                  setSelectedType(t);
                  setStep('picker');
                }}>
                  Выбрать
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 'picker' && selectedType && (
        <DateTimePicker
          eventTypeId={selectedType.id}
          eventType={selectedType}
          selectedSlot={selectedSlot}
          onSlotSelect={pickSlot}
          onBack={() => setStep('types')}
        />
      )}

      {step === 'form' && selectedType && selectedSlot && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="btn" onClick={() => setStep('picker')}>
              ← Назад
            </button>
            <h3 style={{ margin: 0 }}>{selectedType.title}</h3>
          </div>
          <div className="card">
            <p>
              <strong>Время:</strong> {selectedSlot.startTime ? new Date(selectedSlot.startTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''} —{' '}
              {selectedSlot.endTime ? new Date(selectedSlot.endTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}
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

      {step === 'done' && booking && (
        <div className="card">
          <h3>Бронирование подтверждено 🎉</h3>
          <p>
            Номер брони: <strong>{booking.id}</strong>
          </p>
          <p>Время: {booking.startTime ? new Date(booking.startTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</p>
          <button className="btn primary" onClick={reset}>
            Записаться ещё
          </button>
        </div>
      )}
    </div>
  );
}
