// Модели данных по контракту (см. api-spec/main.tsp).

export interface EventType {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
  createdAt: string;
}

export interface CreateEventTypeRequest {
  title: string;
  description?: string;
  durationMinutes: number;
}

export interface TimeSlot {
  startTime: string; // ISO 8601: "2024-01-15T10:00:00Z"
  endTime: string;
  isAvailable: boolean;
}

export interface Booking {
  id: string;
  eventTypeId: string;
  guestName: string;
  guestEmail?: string;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export interface CreateBookingRequest {
  eventTypeId: string;
  guestName: string;
  guestEmail?: string;
  startTime: string;
}

export interface ValidationError {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface SuccessResult {
  success: boolean;
}