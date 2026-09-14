import type { TimeSlot } from '../api/types';
import { formatTime } from '../lib/format';

interface TimeSlotsProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  loading?: boolean;
  dateLabel?: string;
}

export default function TimeSlots({
  slots,
  selectedSlot,
  onSelectSlot,
  loading,
  dateLabel,
}: TimeSlotsProps) {
  const available = slots.filter((s) => s.isAvailable);

  if (loading) {
    return (
      <div className="timeslots">
        <div className="timeslots-header">
          <span className="timeslots-date">{dateLabel}</span>
        </div>
        <div className="timeslots-loading">
          <span className="spin">⏳</span> Загрузка слотов…
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="timeslots">
        <div className="timeslots-header">
          <span className="timeslots-date">{dateLabel}</span>
        </div>
        <div className="timeslots-empty">Нет слотов на эту дату</div>
      </div>
    );
  }

  return (
    <div className="timeslots">
      <div className="timeslots-header">
        <span className="timeslots-date">{dateLabel}</span>
        <span className="timeslots-count">
          {available.length} из {slots.length} свободно
        </span>
      </div>

      <div className="timeslots-timeline">
        {slots.map((slot) => {
          const isSelected = selectedSlot?.startTime === slot.startTime;
          const classes = [
            'timeslot',
            !slot.isAvailable && 'unavailable',
            isSelected && 'selected',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={slot.startTime}
              className={classes}
              disabled={!slot.isAvailable}
              onClick={() => onSelectSlot(slot)}
            >
              <div className="timeslot-time">{formatTime(slot.startTime)}</div>
              <div className="timeslot-duration">
                — {formatTime(slot.endTime)}
              </div>
              {!slot.isAvailable && <div className="timeslot-badge">Занято</div>}
              {isSelected && <div className="timeslot-badge selected-badge">Выбрано</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
