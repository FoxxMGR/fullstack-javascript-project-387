import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;

// ========== МОДЕЛИ ДАННЫХ ==========

/** Тип события, который создает владелец */
model EventType {
  @visibility(Lifecycle.Read)
  id: string;

  @minLength(1)
  @maxLength(100)
  title: string;

  @maxLength(500)
  description?: string;

  @minValue(5)
  @maxValue(480)
  durationMinutes: int32;

  @visibility(Lifecycle.Read)
  createdAt: string;
}

/** Данные для создания типа события (без автогенерируемых полей) */
model CreateEventTypeRequest {
  @minLength(1)
  @maxLength(100)
  title: string;

  @maxLength(500)
  description?: string;

  @minValue(5)
  @maxValue(480)
  durationMinutes: int32;
}

/** Слот времени для бронирования */
model TimeSlot {
  startTime: string; // ISO 8601: "2024-01-15T10:00:00Z"
  endTime: string;
  isAvailable: boolean;
}

/** Бронирование, созданное гостем */
model Booking {
  @visibility(Lifecycle.Read)
  id: string;

  eventTypeId: string;

  @minLength(1)
  @maxLength(100)
  guestName: string;

  @format("email")
  guestEmail?: string;

  startTime: string;
  endTime: string;

  @visibility(Lifecycle.Read)
  createdAt: string;
}

/** Запрос на создание бронирования */
model CreateBookingRequest {
  eventTypeId: string;
  guestName: string;
  guestEmail?: string;
  startTime: string;
}

/** Ошибка валидации */
model ValidationError {
  code: string;
  message: string;
  details?: Record<string>;
}

/** Результат успешной операции, не возвращающей тело */
model SuccessResult {
  success: boolean;
}

// ========== ПРИЛОЖЕНИЕ ==========

/** Приложение: публичное API гостя и админский API владельца. */
@service(#{ title: "Calendar Booking API" })
namespace CalendarBookingService {
  // ========== ЭНДПОИНТЫ ДЛЯ ГОСТЯ (публичные) ==========

  /** Публичное API для гостей (без авторизации) */
  @route("/guest")
  @tag("Guest")
  namespace Guest {
    /** Получить все доступные типы событий */
    @route("/event-types")
    @get
    op listEventTypes(): EventType[] | ValidationError;

    /** Получить свободные слоты для конкретного типа события на 14 дней */
    @route("/availability")
    @get
    op getAvailableSlots(
      @query eventTypeId: string,
      @query dateFrom?: string, // ISO дата, по умолчанию сегодня
      @query dateTo?: string    // ISO дата, по умолчанию +14 дней
    ): TimeSlot[] | ValidationError;

    /** Создать новое бронирование */
    @route("/bookings")
    @post
    op createBooking(
      @body request: CreateBookingRequest
    ): Booking | ValidationError;
  }

  // ========== ЭНДПОИНТЫ ДЛЯ ВЛАДЕЛЬЦА (админка) ==========

  /** Админское API для владельца календаря */
  @route("/admin")
  @tag("Admin")
  namespace Admin {
    /** Создать новый тип события */
    @route("/event-types")
    @post
    op createEventType(
      @body eventType: CreateEventTypeRequest
    ): EventType | ValidationError;

    /** Получить все типы событий (для управления) */
    @route("/event-types")
    @get
    op listEventTypesAdmin(): EventType[];

    /** Получить все бронирования (предстоящие встречи) */
    @route("/bookings")
    @get
    op listBookings(
      @query from?: string,
      @query to?: string,
      @query status?: "upcoming" | "past"
    ): Booking[];

    /** Отменить бронирование */
    @route("/bookings/{id}")
    @delete
    op cancelBooking(@path id: string): SuccessResult | ValidationError;
  }
}

