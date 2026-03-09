// main.js — Календарь с барабаном и модалками
(function () {
  ("use strict");

  // ==========================================================================
  // 1. ГЛОБАЛЬНЫЕ ЭЛЕМЕНТЫ DOM
  // ==========================================================================
  const monthHeader = document.querySelector(".app-header__month");
  const calendarGrid = document.querySelector(".calendar-grid");
  const modal = document.getElementById("monthPickerModal");
  const monthWheelItems = document.getElementById("monthWheelItems");
  const yearWheelItems = document.getElementById("yearWheelItems");
  const closeBtn = document.querySelector(".month-picker-close");
  const confirmBtn = document.querySelector(".month-picker-button--confirm");
  const overlay = document.querySelector(".month-picker-overlay");

  // ==========================================================================
  // 2. ЭЛЕМЕНТЫ МОДАЛКИ ДНЯ
  // ==========================================================================
  const dayModal = document.getElementById("dayModal");
  const dayModalDate = document.getElementById("dayModalDate");
  const dayModalClose = document.getElementById("dayModalClose");
  const dayModalCancel = document.getElementById("dayModalCancel");
  const dayModalSave = document.getElementById("dayModalSave");
  const addPositionBtn = document.getElementById("addPositionBtn");
  const positionsList = document.getElementById("positionsList");
  const shiftStart = document.getElementById("shiftStart");
  const shiftEnd = document.getElementById("shiftEnd");
  const dayModalDelete = document.getElementById("dayModalDelete");

  // ==========================================================================
  // 3. ЭЛЕМЕНТЫ МОДАЛКИ ВРЕМЕНИ
  // ==========================================================================
  const timePickerModal = document.getElementById("timePickerModal");
  const hourWheelItems = document.getElementById("hourWheelItems");
  const minuteWheelItems = document.getElementById("minuteWheelItems");
  const timePickerClose = document.getElementById("timePickerClose");
  const timePickerConfirm = document.getElementById("timePickerConfirm");
  const timePickerOverlay = document.querySelector(".time-picker-overlay");

  // Проверка наличия основных элементов
  if (!monthHeader || !calendarGrid) {
    console.error("Не найдены необходимые элементы календаря");
    return;
  }

  // ==========================================================================
  // 4. КОНСТАНТЫ
  // ==========================================================================
  const MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

  const MONTH_NAMES_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  const TOTAL_CELLS = 42; // 6x7
  const ANIMATION_DURATION = 300; // REFACTOR: вынес время анимации в константу

  // ==========================================================================
  // 4.1 ВЕРСИЯ ПРИЛОЖЕНИЯ
  // ==========================================================================
  const APP_VERSION = "1.0.0"; // Меняйте при каждом релизе

  // ==========================================================================
  // 5. СОСТОЯНИЕ ПРИЛОЖЕНИЯ
  // ==========================================================================
  let state = {
    currentDate: new Date(),
    selectedDate: new Date(),
    selectedDateStr: new Date().toDateString(),
    tempMonth: new Date().getMonth(),
    tempYear: new Date().getFullYear(),
  };

  // Для определения двойного клика
  let clickTimer = null;
  const DOUBLE_CLICK_DELAY = 250;

  let isSummaryMonthPicker = false; // флаг для модалки месяца (главная/сводка)

  // Для барабанов
  let wheelHandlerMonth, wheelHandlerYear;

  // Для модалки времени
  let activeTimeInput = null;
  let timePickerHourHandler, timePickerMinuteHandler;
  let closeDayModalTimer = null; // FIX: для отмены предыдущего таймера анимации

  // ==========================================================================
  // 6. УТИЛИТЫ
  // ==========================================================================
  function isWeekend(year, month, day) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  function formatDateKey(year, month, day) {
    return `${year}-${month}-${day}`;
  }

  // Проверка, есть ли данные для указанной даты
  function isDayFilled(year, month, day) {
    const dateKey = formatDateKey(year, month, day);
    const saved = localStorage.getItem(dateKey);
    if (!saved) return false;

    try {
      const data = JSON.parse(saved);
      // День считается заполненным, если есть время ИЛИ позиции
      return (data.startTime && data.endTime) || (data.positions && data.positions.length > 0);
    } catch (e) {
      return false;
    }
  }

  // ==========================================================================
  // 7. ГЕНЕРАЦИЯ ДНЕЙ КАЛЕНДАРЯ
  // ==========================================================================
  function generateCalendarDays(year, month) {
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Смещение для понедельника (ПН = 0)
    const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const days = [];

    // Прошлый месяц
    for (let i = offset; i > 0; i--) {
      const day = daysInPrevMonth - i + 1;
      const prevMonthYear = month === 0 ? year - 1 : year;
      const prevMonth = month === 0 ? 11 : month - 1;
      days.push({
        day,
        month: prevMonth,
        year: prevMonthYear,
        isCurrentMonth: false,
        isWeekend: isWeekend(prevMonthYear, prevMonth, day),
      });
    }

    // Текущий месяц
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        month: month,
        year: year,
        isCurrentMonth: true,
        isWeekend: isWeekend(year, month, i),
      });
    }

    // Следующий месяц
    const nextMonthDays = TOTAL_CELLS - days.length;
    for (let i = 1; i <= nextMonthDays; i++) {
      const nextMonthYear = month === 11 ? year + 1 : year;
      const nextMonth = month === 11 ? 0 : month + 1;
      days.push({
        day: i,
        month: nextMonth,
        year: nextMonthYear,
        isCurrentMonth: false,
        isWeekend: isWeekend(nextMonthYear, nextMonth, i),
      });
    }

    return days;
  }

  // ==========================================================================
  // 8. ОБНОВЛЕНИЕ ЗАГОЛОВКА И ОТРИСОВКА КАЛЕНДАРЯ
  // ==========================================================================
  function updateHeader() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    monthHeader.textContent = `${MONTH_NAMES[month]} ${year}`;
    monthHeader.setAttribute("aria-label", `Текущий месяц: ${MONTH_NAMES[month]} ${year}`);
  }

  function renderCalendar() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const calendarDays = generateCalendarDays(year, month);
    const fragment = document.createDocumentFragment();

    calendarDays.forEach((dayInfo, index) => {
      const cell = document.createElement("div");
      cell.className = "calendar-cell";
      cell.textContent = dayInfo.day;

      cell.dataset.year = dayInfo.year;
      cell.dataset.month = dayInfo.month;
      cell.dataset.day = dayInfo.day;
      cell.dataset.isCurrentMonth = dayInfo.isCurrentMonth;
      cell.dataset.dateKey = formatDateKey(dayInfo.year, dayInfo.month, dayInfo.day);

      if (!dayInfo.isCurrentMonth) cell.classList.add("calendar-cell--empty");
      if (dayInfo.isCurrentMonth && dayInfo.isWeekend) cell.classList.add("calendar-cell--weekend");

      // ПОДСВЕТКА ЗАПОЛНЕННЫХ ДНЕЙ (только для текущего месяца)
      if (dayInfo.isCurrentMonth && isDayFilled(dayInfo.year, dayInfo.month, dayInfo.day)) {
        cell.classList.add("calendar-cell--filled");
      }

      if (dayInfo.isCurrentMonth && dayInfo.day === state.selectedDate.getDate() && dayInfo.month === state.selectedDate.getMonth() && dayInfo.year === state.selectedDate.getFullYear()) {
        cell.classList.add("calendar-cell--selected");
      }

      // Добавляем анимацию появления с задержкой
      cell.style.animation = `cellPopIn 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.1) ${index * 0.02}s forwards`;
      cell.style.opacity = "0";

      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${dayInfo.day} ${MONTH_NAMES_GENITIVE[dayInfo.month]} ${dayInfo.year}`);

      fragment.appendChild(cell);
    });

    calendarGrid.innerHTML = "";
    calendarGrid.appendChild(fragment);
  }

  // ==========================================================================
  // 9. ОБРАБОТЧИКИ КАЛЕНДАРЯ (ОДИНАРНЫЙ КЛИК И ДВОЙНОЙ)
  // ==========================================================================
  // REFACTOR: удалён дублирующийся обработчик из раздела 9, оставлен этот (из раздела 14)
  function handleCalendarClick(event) {
    const cell = event.target.closest(".calendar-cell");
    if (!cell || cell.dataset.isCurrentMonth !== "true") return;

    // Снимаем выделение со всех
    document.querySelectorAll(".calendar-cell--selected").forEach((c) => c.classList.remove("calendar-cell--selected"));
    cell.classList.add("calendar-cell--selected");

    const year = parseInt(cell.dataset.year, 10);
    const month = parseInt(cell.dataset.month, 10);
    const day = parseInt(cell.dataset.day, 10);
    const selectedDate = new Date(year, month, day);

    // Обновляем выбранную дату
    state.selectedDate = selectedDate;
    state.selectedDateStr = selectedDate.toDateString();

    // Показываем контекстную панель с данными
    updateContextPanel(selectedDate);

    // Если был таймер — это двойной клик
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      // При двойном клике открываем модалку и скрываем панель
      contextPanel?.classList.remove("active");
      openDayModal(selectedDate);
      return;
    }

    document.dispatchEvent(
      new CustomEvent("dateSelected", {
        detail: { date: selectedDate },
      }),
    );

    // Ставим таймер для определения двойного клика
    clickTimer = setTimeout(() => {
      clickTimer = null;
    }, DOUBLE_CLICK_DELAY);
  }

  // ==========================================================================
  // 10. МОДАЛКА ВЫБОРА МЕСЯЦА (БАРАБАН)
  // ==========================================================================
  function openModal() {
    state.tempMonth = state.currentDate.getMonth();
    state.tempYear = state.currentDate.getFullYear();

    fillMonthWheel();
    fillYearWheel();

    setTimeout(() => {
      setWheelPosition("month", state.tempMonth);
      setWheelPosition("year", state.tempYear);
    }, 50);

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }

  function setWheelPosition(wheel, value) {
    const container = wheel === "month" ? monthWheelItems : yearWheelItems;
    const items = container.children;
    const itemHeight = 44;

    let targetIndex;
    if (wheel === "month") {
      targetIndex = value;
    } else {
      const currentYear = new Date().getFullYear();
      targetIndex = value - (currentYear - 15);
    }

    targetIndex = Math.max(0, Math.min(items.length - 1, targetIndex));

    Array.from(items).forEach((item) => item.classList.remove("selected"));
    items[targetIndex]?.classList.add("selected");

    const translateY = 78 - targetIndex * itemHeight;
    container.style.transform = `translateY(${translateY}px)`;
  }

  function handleWheelScroll(e, wheel) {
    e.preventDefault();

    const container = wheel === "month" ? monthWheelItems : yearWheelItems;
    const items = container.children;
    const itemHeight = 44;

    let currentIndex = 0;
    const selectedItem = container.querySelector(".selected");
    if (selectedItem) currentIndex = Array.from(items).indexOf(selectedItem);

    const delta = e.deltaY > 0 ? 1 : -1;
    let newIndex = currentIndex + delta;
    newIndex = Math.max(0, Math.min(items.length - 1, newIndex));

    if (newIndex !== currentIndex) {
      if (wheel === "month") {
        setWheelPosition("month", newIndex);
        state.tempMonth = newIndex;
      } else {
        const currentYear = new Date().getFullYear();
        setWheelPosition("year", newIndex + (currentYear - 15));
        state.tempYear = newIndex + (currentYear - 15);
      }
    }

    // REMOVED: пустой setTimeout
  }

  // ==========================================================================
  // 11. УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ ТАЧ-СВАЙПОВ НА БАРАБАНАХ
  // ==========================================================================
  function setupWheelTouch(container, setPositionCallback, tempStateCallback) {
    // REFACTOR: функция теперь вызывается один раз при инициализации, а не при каждом fill
    let startY = 0;
    let startTranslate = 0;
    let currentIndex = 0;

    function getCurrentIndex() {
      const selected = container.querySelector(".selected");
      return selected ? Array.from(container.children).indexOf(selected) : 0;
    }

    // Touch‑события
    container.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        startY = e.touches[0].clientY;
        currentIndex = getCurrentIndex();

        const transform = container.style.transform;
        const match = transform.match(/translateY\((-?\d+)px\)/);
        startTranslate = match ? parseInt(match[1], 10) : 78 - currentIndex * 44;
      },
      { passive: false },
    );

    container.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        const deltaY = e.touches[0].clientY - startY;
        const newTranslate = startTranslate + deltaY;

        const minTranslate = 78 - (container.children.length - 1) * 44;
        const maxTranslate = 78;
        const clampedTranslate = Math.min(maxTranslate, Math.max(minTranslate, newTranslate));

        container.style.transform = `translateY(${clampedTranslate}px)`;

        const itemHeight = 44;
        const nearestIndex = Math.round((78 - clampedTranslate) / itemHeight);
        if (nearestIndex >= 0 && nearestIndex < container.children.length) {
          Array.from(container.children).forEach((item) => item.classList.remove("selected"));
          container.children[nearestIndex].classList.add("selected");

          if (tempStateCallback) tempStateCallback(nearestIndex);
        }
      },
      { passive: false },
    );

    container.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();

        const itemHeight = 44;
        const transform = container.style.transform;
        const match = transform.match(/translateY\((-?\d+)px\)/);
        if (match) {
          const translateY = parseInt(match[1], 10);
          const nearestIndex = Math.round((78 - translateY) / itemHeight);
          const snapIndex = Math.max(0, Math.min(container.children.length - 1, nearestIndex));

          if (setPositionCallback) setPositionCallback(snapIndex);
        }
      },
      { passive: false },
    );

    // Мышиные события для десктопа
    let mouseDown = false;

    container.addEventListener("mousedown", (e) => {
      e.preventDefault();
      mouseDown = true;
      startY = e.clientY;
      currentIndex = getCurrentIndex();

      const transform = container.style.transform;
      const match = transform.match(/translateY\((-?\d+)px\)/);
      startTranslate = match ? parseInt(match[1], 10) : 78 - currentIndex * 44;
    });

    container.addEventListener("mousemove", (e) => {
      if (!mouseDown) return;
      e.preventDefault();

      const deltaY = e.clientY - startY;
      const newTranslate = startTranslate + deltaY;

      const minTranslate = 78 - (container.children.length - 1) * 44;
      const maxTranslate = 78;
      const clampedTranslate = Math.min(maxTranslate, Math.max(minTranslate, newTranslate));

      container.style.transform = `translateY(${clampedTranslate}px)`;

      const itemHeight = 44;
      const nearestIndex = Math.round((78 - clampedTranslate) / itemHeight);
      if (nearestIndex >= 0 && nearestIndex < container.children.length) {
        Array.from(container.children).forEach((item) => item.classList.remove("selected"));
        container.children[nearestIndex].classList.add("selected");

        if (tempStateCallback) tempStateCallback(nearestIndex);
      }
    });

    container.addEventListener("mouseup", (e) => {
      if (!mouseDown) return;
      mouseDown = false;
      e.preventDefault();

      const itemHeight = 44;
      const transform = container.style.transform;
      const match = transform.match(/translateY\((-?\d+)px\)/);
      if (match) {
        const translateY = parseInt(match[1], 10);
        const nearestIndex = Math.round((78 - translateY) / itemHeight);
        const snapIndex = Math.max(0, Math.min(container.children.length - 1, nearestIndex));

        if (setPositionCallback) setPositionCallback(snapIndex);
      }
    });

    container.addEventListener("mouseleave", () => {
      if (mouseDown) {
        mouseDown = false;

        const itemHeight = 44;
        const transform = container.style.transform;
        const match = transform.match(/translateY\((-?\d+)px\)/);
        if (match) {
          const translateY = parseInt(match[1], 10);
          const nearestIndex = Math.round((78 - translateY) / itemHeight);
          const snapIndex = Math.max(0, Math.min(container.children.length - 1, nearestIndex));

          if (setPositionCallback) setPositionCallback(snapIndex);
        }
      }
    });
  }

  // ==========================================================================
  // 12. ЗАПОЛНЕНИЕ БАРАБАНОВ (МЕСЯЦЫ И ГОДЫ)
  // ==========================================================================
  function fillMonthWheel() {
    let html = "";
    MONTH_NAMES.forEach((month, index) => {
      html += `<div class="month-picker-wheel-item" data-value="${index}">${month}</div>`;
    });
    monthWheelItems.innerHTML = html;

    monthWheelItems.removeEventListener("wheel", wheelHandlerMonth);
    monthWheelItems.addEventListener("wheel", (wheelHandlerMonth = (e) => handleWheelScroll(e, "month")), { passive: false });

    Array.from(monthWheelItems.children).forEach((item) => {
      item.addEventListener("click", () => {
        const value = parseInt(item.dataset.value, 10);
        setWheelPosition("month", value);
        state.tempMonth = value;
      });
    });

    // REFACTOR: вызов setupWheelTouch убран отсюда, теперь он один раз в init
  }

  function fillYearWheel() {
    const currentYear = new Date().getFullYear();
    let html = "";
    for (let year = currentYear - 15; year <= currentYear + 15; year++) {
      html += `<div class="month-picker-wheel-item" data-value="${year}">${year}</div>`;
    }
    yearWheelItems.innerHTML = html;

    yearWheelItems.removeEventListener("wheel", wheelHandlerYear);
    yearWheelItems.addEventListener("wheel", (wheelHandlerYear = (e) => handleWheelScroll(e, "year")), { passive: false });

    Array.from(yearWheelItems.children).forEach((item) => {
      item.addEventListener("click", () => {
        const value = parseInt(item.dataset.value, 10);
        setWheelPosition("year", value);
        state.tempYear = value;
      });
    });

    // REFACTOR: вызов setupWheelTouch убран отсюда
  }

  // ==========================================================================
  // 13. МОДАЛКА ДНЯ (РАСШИРЕННЫЙ ФУНКЦИОНАЛ)
  // ==========================================================================

  // Расчёт общего заработка (только для заполненных позиций)
  function calculateTotalEarned() {
    const positionItems = document.querySelectorAll(".day-modal-position-item");
    let total = 0;

    positionItems.forEach((item) => {
      const select = item.querySelector(".day-modal-select");
      const quantityInput = item.querySelector(".day-modal-quantity-input");
      const earnedSpan = item.querySelector(".day-modal-earned-value");

      const quantity = parseInt(quantityInput.value, 10) || 0;

      if (quantity > 0) {
        const price = getPositionPrice(select.value);
        const earned = price * quantity;
        earnedSpan.textContent = `${earned.toLocaleString()} ₽`;
        total += earned;
      } else {
        earnedSpan.textContent = "0 ₽";
      }
    });

    return total;
  }

  // Расчёт отработанных часов и минут (с вычетом 30 мин)
  function calculateWorkedTime(startTime, endTime) {
    if (!startTime || !endTime) return { hours: 0, minutes: 0 };

    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    let startTotal = startHour * 60 + startMin;
    let endTotal = endHour * 60 + endMin;

    // Если конечное время меньше начального (переход через полночь)
    if (endTotal < startTotal) endTotal += 24 * 60;

    let diffMinutes = endTotal - startTotal;

    // Вычитаем 30 минут перерыва, если смена больше 0
    if (diffMinutes > 0) {
      diffMinutes = diffMinutes - 30;
      if (diffMinutes < 0) diffMinutes = 0;
    }

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    return { hours, minutes };
  }

  // Форматирование времени
  function formatWorkedTime(time) {
    if (time.hours === 0 && time.minutes === 0) return "0ч";
    if (time.minutes === 0) return `${time.hours}ч`;
    return `${time.hours}:${time.minutes.toString().padStart(2, "0")}`;
  }

  // Обновление статистики (общий заработок и часы)
  function updateStats() {
    // Общий заработок
    const totalEarned = calculateTotalEarned();
    const totalEarnedSpan = document.getElementById("totalEarnedValue");
    if (totalEarnedSpan) {
      totalEarnedSpan.textContent = `${totalEarned.toLocaleString()} ₽`;
    }

    // Отработанное время - используем текущие значения из полей
    const workedTime = calculateWorkedTime(shiftStart.value, shiftEnd.value);
    const totalHoursSpan = document.getElementById("totalHoursValue");
    if (totalHoursSpan) {
      totalHoursSpan.textContent = formatWorkedTime(workedTime);
    }
  }

  // Определение типа смены по времени
  function updateShiftTypeIcon() {
    // Для модалки дня
    const modalDayIcon = document.getElementById("modalShiftTypeDay");
    const modalNightIcon = document.getElementById("modalShiftTypeNight");

    // Для контекстной панели
    const contextDayIcon = document.getElementById("contextShiftTypeDay");
    const contextNightIcon = document.getElementById("contextShiftTypeNight");

    const startHour = parseInt(shiftStart.value.split(":")[0]);

    const isDayShift = startHour >= 7 && startHour < 19;

    // Обновляем иконки в модалке
    if (modalDayIcon && modalNightIcon) {
      if (isDayShift) {
        modalDayIcon.style.display = "flex";
        modalNightIcon.style.display = "none";
      } else {
        modalDayIcon.style.display = "none";
        modalNightIcon.style.display = "flex";
      }
    }

    // Обновляем иконки в контекстной панели
    if (contextDayIcon && contextNightIcon) {
      if (isDayShift) {
        contextDayIcon.style.display = "flex";
        contextNightIcon.style.display = "none";
      } else {
        contextDayIcon.style.display = "none";
        contextNightIcon.style.display = "flex";
      }
    }
  }

  // Загрузка данных из localStorage
  function loadDayData(date) {
    if (!shiftStart || !shiftEnd) return;

    const dateKey = formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());
    const saved = localStorage.getItem(dateKey);
    const positionItems = document.querySelectorAll(".day-modal-position-item");

    if (saved) {
      try {
        const data = JSON.parse(saved);
        shiftStart.value = data.startTime || "07:00";
        shiftEnd.value = data.endTime || "15:30";

        if (data.positions && Array.isArray(data.positions)) {
          // Сначала сбрасываем все на дефолт
          positionItems.forEach((item) => {
            const select = item.querySelector(".day-modal-select");
            const quantityInput = item.querySelector(".day-modal-quantity-input");
            if (select && positions.length > 0) select.value = positions[0].id;
            if (quantityInput) quantityInput.value = "1";
          });

          // Потом заполняем сохранённые
          data.positions.forEach((posData, index) => {
            if (index < positionItems.length) {
              const item = positionItems[index];
              const select = item.querySelector(".day-modal-select");
              const quantityInput = item.querySelector(".day-modal-quantity-input");
              if (select && posData.positionId) select.value = posData.positionId;
              if (quantityInput && posData.quantity) quantityInput.value = posData.quantity;
            }
          });
        }
      } catch (e) {
        // REMOVED: console.warn
        setDefaultValues();
      }
    } else {
      setDefaultValues();
    }

    updateStats();
    updateShiftTypeIcon();
  }

  function setDefaultValues() {
    shiftStart.value = "07:00";
    shiftEnd.value = "15:30";
    const positionItems = document.querySelectorAll(".day-modal-position-item");
    positionItems.forEach((item) => {
      const select = item.querySelector(".day-modal-select");
      const quantityInput = item.querySelector(".day-modal-quantity-input");
      if (select) select.value = "1";
      if (quantityInput) quantityInput.value = "0";
    });
  }

  // Сохранение данных
  function saveDayData() {
    const date = state.selectedDate;
    if (!date) return;

    const dateKey = formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());

    const positionItems = document.querySelectorAll(".day-modal-position-item");
    const positions = [];
    positionItems.forEach((item) => {
      const select = item.querySelector(".day-modal-select");
      const quantityInput = item.querySelector(".day-modal-quantity-input");
      const quantity = parseInt(quantityInput.value, 10) || 0;

      // Сохраняем только если количество > 0
      if (quantity > 0 && select) {
        positions.push({
          positionId: select.value,
          quantity: quantity,
        });
      }
    });

    const data = {
      startTime: shiftStart.value,
      endTime: shiftEnd.value,
      positions: positions,
    };

    localStorage.setItem(dateKey, JSON.stringify(data));
    updateMainStats();
    renderCalendar();
    closeDayModal();
  }

  // Удаление данных дня (очистка) - без подтверждения, с закрытием модалки
  function deleteDayData() {
    const date = state.selectedDate;
    if (!date) return;

    const dateKey = formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());

    // Удаляем из localStorage
    localStorage.removeItem(dateKey);

    // Обновляем статистику на главной
    updateMainStats();

    // Перерисовываем календарь (чтобы убрать точку)
    renderCalendar();

    // Обновляем контекстную панель (если этот день был выбран)
    if (state.selectedDate && state.selectedDate.getDate() === date.getDate() && state.selectedDate.getMonth() === date.getMonth() && state.selectedDate.getFullYear() === date.getFullYear()) {
      updateContextPanel(date);
    }

    // Закрываем модалку
    closeDayModal();
  }

  // Инициализация обработчиков на позициях и полях времени
  function initPositionListeners() {
    const positionItems = document.querySelectorAll(".day-modal-position-item");
    positionItems.forEach((item) => {
      const select = item.querySelector(".day-modal-select");
      const quantityInput = item.querySelector(".day-modal-quantity-input");

      if (select) {
        select.addEventListener("change", () => {
          updateStats();
        });
      }
      if (quantityInput) {
        quantityInput.addEventListener("input", () => {
          updateStats();
        });
        // Для мобильных клавиатур
        quantityInput.setAttribute("inputmode", "numeric");
        quantityInput.setAttribute("pattern", "[0-9]*");
      }
    });

    if (shiftStart && shiftEnd) {
      shiftStart.addEventListener("change", () => {
        updateShiftTypeIcon();
        updateStats();
      });
      shiftEnd.addEventListener("change", () => {
        updateShiftTypeIcon();
        updateStats();
      });
    }
  }

  // Функция для обновления выпадающих списков в форме дня
  function renderDayModalPositions() {
    const positionItems = document.querySelectorAll(".day-modal-position-item");

    positionItems.forEach((item) => {
      const select = item.querySelector(".day-modal-select");
      if (!select) return;

      // Сохраняем текущее выбранное значение
      const currentValue = select.value;

      // Очищаем select
      select.innerHTML = "";

      // Добавляем позиции из справочника
      positions.forEach((pos) => {
        const option = document.createElement("option");
        option.value = pos.id;
        option.textContent = pos.name;
        select.appendChild(option);
      });

      // Восстанавливаем выбранное значение, если оно было и позиция существует
      if (currentValue && positions.some((p) => p.id == currentValue)) {
        select.value = currentValue;
      } else {
        // Если ничего не было выбрано или позиция удалена, ставим первую
        select.value = positions[0]?.id || "";
      }
    });
  }

  // Переопределяем openDayModal
  function openDayModal(date) {
    if (!dayModal) return;

    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    // Полная дата в заголовке
    dayModalDate.textContent = `${day} ${MONTH_NAMES_GENITIVE[month]} ${year}`;

    // Короткая дата для статистики
    const shortDateSpan = document.getElementById("dayModalDateShort");
    if (shortDateSpan) {
      shortDateSpan.textContent = `${day} ${MONTH_NAMES_GENITIVE[month]}`;
    }

    // Загружаем данные - внутри уже есть updateStats и updateShiftTypeIcon
    loadDayData(date);

    // ОБНОВЛЯЕМ ВЫПАДАЮЩИЕ СПИСКИ ПОЗИЦИЙ
    renderDayModalPositions();

    dayModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeDayModal() {
    if (!dayModal) return;

    // FIX: отменяем предыдущий таймер анимации, если он был
    if (closeDayModalTimer) {
      clearTimeout(closeDayModalTimer);
      closeDayModalTimer = null;
    }

    // Добавляем класс closing для анимации
    dayModal.classList.add("closing");

    // Ждём окончания анимации (300ms = 0.3s)
    closeDayModalTimer = setTimeout(() => {
      dayModal.classList.remove("active");
      dayModal.classList.remove("closing");
      document.body.style.overflow = "";
      closeDayModalTimer = null;
    }, ANIMATION_DURATION);
  }

  // ==========================================================================
  // 14. КОНТЕКСТНАЯ ПАНЕЛЬ ВЫБРАННОГО ДНЯ
  // ==========================================================================
  const contextPanel = document.getElementById("dayContextPanel");
  const contextDateShort = document.getElementById("contextDateShort");
  const contextShiftTypeDay = document.getElementById("contextShiftTypeDay");
  const contextShiftTypeNight = document.getElementById("contextShiftTypeNight");
  const contextTotalEarned = document.getElementById("contextTotalEarned");
  const contextTotalHours = document.getElementById("contextTotalHours");
  const contextPositionsList = document.getElementById("contextPositionsList");

  // Получение цены по ID позиции
  function getPositionPrice(id) {
    const pos = positions.find((p) => p.id == id);
    return pos ? pos.price : 0;
  }

  // Получение названия по ID позиции
  function getPositionName(id) {
    const pos = positions.find((p) => p.id == id);
    return pos ? pos.name : `Позиция ${id}`;
  }

  // Обновление контекстной панели
  // Обновление контекстной панели
  function updateContextPanel(date) {
    if (!contextPanel) return;

    // Если дата не передана или невалидна - показываем плейсхолдер
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      clearContextPanel(true); // true = показывать плейсхолдер выбора
      contextPanel.classList.add("active");
      return;
    }

    const day = date.getDate();
    const month = date.getMonth();

    // Короткая дата
    if (contextDateShort) {
      contextDateShort.textContent = `${day} ${MONTH_NAMES_GENITIVE[month]}`;
    }

    // Загружаем данные для этой даты
    const dateKey = formatDateKey(date.getFullYear(), month, day);
    const saved = localStorage.getItem(dateKey);

    if (saved) {
      try {
        const data = JSON.parse(saved);

        // Обновляем статистику
        if (contextTotalEarned) {
          const total =
            data.positions?.reduce((sum, pos) => {
              return sum + (getPositionPrice(pos.positionId) || 0) * (pos.quantity || 0);
            }, 0) || 0;
          contextTotalEarned.textContent = `${total.toLocaleString()} ₽`;
        }

        if (contextTotalHours) {
          const workedTime = calculateWorkedTime(data.startTime, data.endTime);
          contextTotalHours.textContent = formatWorkedTime(workedTime);
        }

        updateContextShiftType(data.startTime, data.endTime);

        const filledPositions = (data.positions || []).filter((pos) => pos.quantity > 0);
        renderContextPositions(filledPositions);
      } catch (e) {
        clearContextPanel();
      }
    } else {
      clearContextPanel();
    }

    contextPanel.classList.add("active");
  }

  function updateContextShiftType(startTime, endTime) {
    const contextDayIcon = document.getElementById("contextShiftTypeDay");
    const contextNightIcon = document.getElementById("contextShiftTypeNight");

    if (!contextDayIcon || !contextNightIcon) return;

    const startHour = parseInt(startTime.split(":")[0]);
    const isDayShift = startHour >= 7 && startHour < 19;

    if (isDayShift) {
      contextDayIcon.style.display = "flex";
      contextNightIcon.style.display = "none";
    } else {
      contextDayIcon.style.display = "none";
      contextNightIcon.style.display = "flex";
    }
  }

  function renderContextPositions(positions) {
    if (!contextPositionsList) return;

    // Если нет заполненных позиций
    if (!positions || positions.length === 0) {
      contextPositionsList.innerHTML = '<div class="day-context-panel__empty">Нет данных за этот день</div>';
      return;
    }

    let html = "";
    positions.forEach((pos) => {
      const price = getPositionPrice(pos.positionId) || 0;
      const earned = price * pos.quantity;
      const positionName = getPositionName(pos.positionId);

      html += `
      <div class="day-context-position-item">
        <div class="day-context-position-info">
          <span class="day-context-position-name">${positionName}</span>
        </div>
        <span class="day-context-position-quantity">×${pos.quantity}</span>
        <span class="day-context-position-earned">${earned.toLocaleString()} ₽</span>
      </div>
    `;
    });

    contextPositionsList.innerHTML = html;
  }

  function clearContextPanel(showPlaceholder = false) {
    if (contextTotalEarned) contextTotalEarned.textContent = "0 ₽";
    if (contextTotalHours) contextTotalHours.textContent = "0 ч";
    if (contextShiftTypeDay) contextShiftTypeDay.style.display = "flex";
    if (contextShiftTypeNight) contextShiftTypeNight.style.display = "none";

    if (contextPositionsList) {
      if (showPlaceholder) {
        contextPositionsList.innerHTML = '<div class="day-context-panel__empty">Выберите день в календаре</div>';
        // Также можно очистить короткую дату
        if (contextDateShort) contextDateShort.textContent = "День не выбран";
      } else {
        contextPositionsList.innerHTML = '<div class="day-context-panel__empty">Нет данных за этот день</div>';
      }
    }
  }

  // ==========================================================================
  // 14.5 ОБНОВЛЕНИЕ СТАТИСТИКИ НА ГЛАВНОЙ (ЗА МЕСЯЦ)
  // ==========================================================================
  function updateMainStats() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();

    let totalEarned = 0;
    let totalMinutes = 0;

    // Перебираем все дни текущего месяца
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(year, month, day);
      const saved = localStorage.getItem(dateKey);

      if (saved) {
        try {
          const data = JSON.parse(saved);

          // Суммируем заработок по всем позициям дня
          if (data.positions && Array.isArray(data.positions)) {
            data.positions.forEach((pos) => {
              totalEarned += (getPositionPrice(pos.positionId) || 0) * (pos.quantity || 0);
            });
          }

          // Суммируем отработанные минуты
          if (data.startTime && data.endTime) {
            const worked = calculateWorkedTime(data.startTime, data.endTime);
            totalMinutes += worked.hours * 60 + worked.minutes;
          }
        } catch (e) {
          // Игнорируем битые записи
        }
      }
    }

    // Обновляем DOM
    const earnedSpan = document.querySelector(".stat-card--earned .stat-card__number");
    const hoursSpan = document.querySelector(".stat-card--hours .stat-card__number");

    if (earnedSpan) {
      earnedSpan.textContent = totalEarned.toLocaleString();
    }

    if (hoursSpan) {
      // Показываем целые часы (можно добавить десятые, если нужно)
      const hours = Math.floor(totalMinutes / 60);
      hoursSpan.textContent = hours;
    }
  }

  // ==========================================================================
  // 15. МОДАЛКА ВРЕМЕНИ (ФУНКЦИИ)
  // ==========================================================================
  function openTimePicker(inputElement) {
    if (!timePickerModal) return;

    activeTimeInput = inputElement;
    let currentValue = inputElement.value || "09:00";
    let [hours, minutes] = currentValue.split(":").map(Number);

    fillHourWheel();
    fillMinuteWheel();

    setTimeout(() => {
      setTimeWheelPosition("hour", hours);
      setTimeWheelPosition("minute", minutes);
    }, 50);

    timePickerModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeTimePicker() {
    if (!timePickerModal) return;
    timePickerModal.classList.remove("active");
    document.body.style.overflow = "";
    activeTimeInput = null;
  }

  function fillHourWheel() {
    let html = "";
    for (let hour = 0; hour < 24; hour++) {
      let displayHour = hour.toString().padStart(2, "0");
      html += `<div class="time-picker-wheel-item" data-value="${hour}">${displayHour}</div>`;
    }
    hourWheelItems.innerHTML = html;

    hourWheelItems.removeEventListener("wheel", timePickerHourHandler);
    hourWheelItems.addEventListener("wheel", (timePickerHourHandler = (e) => handleTimeWheelScroll(e, "hour")), { passive: false });

    Array.from(hourWheelItems.children).forEach((item) => {
      item.addEventListener("click", () => {
        const value = parseInt(item.dataset.value, 10);
        setTimeWheelPosition("hour", value);
      });
    });

    // Тач‑свайпы уже установлены в init один раз
  }

  function fillMinuteWheel() {
    let html = "";
    for (let minute = 0; minute < 60; minute++) {
      let displayMinute = minute.toString().padStart(2, "0");
      html += `<div class="time-picker-wheel-item" data-value="${minute}">${displayMinute}</div>`;
    }
    minuteWheelItems.innerHTML = html;

    minuteWheelItems.removeEventListener("wheel", timePickerMinuteHandler);
    minuteWheelItems.addEventListener("wheel", (timePickerMinuteHandler = (e) => handleTimeWheelScroll(e, "minute")), { passive: false });

    Array.from(minuteWheelItems.children).forEach((item) => {
      item.addEventListener("click", () => {
        const value = parseInt(item.dataset.value, 10);
        setTimeWheelPosition("minute", value);
      });
    });

    // Тач‑свайпы уже установлены в init один раз
  }

  function setTimeWheelPosition(wheel, value) {
    const container = wheel === "hour" ? hourWheelItems : minuteWheelItems;
    const items = container.children;
    const itemHeight = 44;

    let targetIndex = value;
    targetIndex = Math.max(0, Math.min(items.length - 1, targetIndex));

    Array.from(items).forEach((item) => item.classList.remove("selected"));
    items[targetIndex]?.classList.add("selected");

    const translateY = 78 - targetIndex * itemHeight;
    container.style.transform = `translateY(${translateY}px)`;
  }

  function handleTimeWheelScroll(e, wheel) {
    e.preventDefault();

    const container = wheel === "hour" ? hourWheelItems : minuteWheelItems;
    const items = container.children;

    let currentIndex = 0;
    const selectedItem = container.querySelector(".selected");
    if (selectedItem) currentIndex = Array.from(items).indexOf(selectedItem);

    const delta = e.deltaY > 0 ? 1 : -1;
    let newIndex = currentIndex + delta;
    newIndex = Math.max(0, Math.min(items.length - 1, newIndex));

    if (newIndex !== currentIndex) {
      setTimeWheelPosition(wheel, newIndex);
    }

    // REMOVED: пустой setTimeout
  }

  function confirmTimeSelection() {
    if (!activeTimeInput) {
      closeTimePicker();
      return;
    }

    const selectedHour = hourWheelItems.querySelector(".selected");
    const selectedMinute = minuteWheelItems.querySelector(".selected");

    if (selectedHour && selectedMinute) {
      const hour = parseInt(selectedHour.dataset.value, 10).toString().padStart(2, "0");
      const minute = parseInt(selectedMinute.dataset.value, 10).toString().padStart(2, "0");
      activeTimeInput.value = `${hour}:${minute}`;

      // Важно! Обновляем статистику сразу после установки значения
      updateStats();
      updateShiftTypeIcon();
    }

    closeTimePicker();
  }

  // ==========================================================================
  // 15. ОБРАБОТЧИКИ ДЛЯ МОДАЛКИ ВРЕМЕНИ
  // ==========================================================================
  if (shiftStart && shiftEnd) {
    shiftStart.addEventListener("click", () => openTimePicker(shiftStart));
    shiftEnd.addEventListener("click", () => openTimePicker(shiftEnd));
  }

  if (timePickerClose) timePickerClose.addEventListener("click", closeTimePicker);
  if (timePickerConfirm) timePickerConfirm.addEventListener("click", confirmTimeSelection);
  if (timePickerOverlay) timePickerOverlay.addEventListener("click", closeTimePicker);

  // ==========================================================================
  // 16. КЛАВИАТУРНЫЕ ОБРАБОТЧИКИ
  // ==========================================================================
  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      const cell = e.target.closest(".calendar-cell");
      if (cell) {
        e.preventDefault();
        cell.click();
      }
    }
  }

  function handleEscapeKey(e) {
    if (e.key === "Escape") {
      if (modal?.classList.contains("active")) closeModal();
      if (dayModal?.classList.contains("active")) closeDayModal();
      if (timePickerModal?.classList.contains("active")) closeTimePicker();
    }
  }

  // ==========================================================================
  // 17. ИНИЦИАЛИЗАЦИЯ
  // ==========================================================================
  function init() {
    const today = new Date();
    state.currentDate = new Date(today);
    state.selectedDate = new Date(today);
    state.selectedDateStr = today.toDateString();

    updateHeader();
    renderCalendar();
    updateMainStats();
    initPositionListeners();

    // Устанавливаем активную кнопку навигации
    const homeButton = document.querySelector('[data-page="home"]');
    if (homeButton) {
      homeButton.classList.add("active");
    }

    const grid = calendarGrid;
    grid.removeEventListener("click", handleCalendarClick);
    monthHeader.removeEventListener("click", openModal);

    monthHeader.addEventListener("click", () => {
      if (currentPage === "summary") {
        openSummaryMonthPicker();
      } else if (currentPage === "reference" || currentPage === "settings") {
        // На справочнике и настройках нельзя выбрать месяц
      } else {
        openModal();
      }
    });
    grid.addEventListener("click", handleCalendarClick);

    // Показываем панель, но без выбранного дня
    updateContextPanel(null); // или undefined

    // Обработчики модалки месяца
    if (closeBtn) {
      closeBtn.removeEventListener("click", closeModal);
      closeBtn.addEventListener("click", closeModal);
    }
    if (overlay) {
      overlay.removeEventListener("click", closeModal);
      overlay.addEventListener("click", closeModal);
    }
    if (confirmBtn) {
      confirmBtn.removeEventListener("click", confirmSelection);
      confirmBtn.addEventListener("click", confirmSelection);
    }

    // REFACTOR: устанавливаем обработчики тач-свайпов для колёсиков один раз
    setupWheelTouch(
      monthWheelItems,
      (index) => {
        setWheelPosition("month", index);
        state.tempMonth = index;
      },
      (index) => {
        state.tempMonth = index;
      },
    );

    setupWheelTouch(
      yearWheelItems,
      (index) => {
        const currentYear = new Date().getFullYear();
        const yearValue = index + (currentYear - 15);
        setWheelPosition("year", yearValue);
        state.tempYear = yearValue;
      },
      (index) => {
        const currentYear = new Date().getFullYear();
        state.tempYear = index + (currentYear - 15);
      },
    );

    setupWheelTouch(hourWheelItems, (index) => setTimeWheelPosition("hour", index), null);
    setupWheelTouch(minuteWheelItems, (index) => setTimeWheelPosition("minute", index), null);

    // Обработчики модалки дня
    if (dayModalClose) {
      dayModalClose.removeEventListener("click", closeDayModal);
      dayModalClose.addEventListener("click", closeDayModal);
    }
    if (dayModalCancel) {
      dayModalCancel.removeEventListener("click", closeDayModal);
      dayModalCancel.addEventListener("click", closeDayModal);
    }
    if (dayModalSave) {
      dayModalSave.removeEventListener("click", saveDayData);
      dayModalSave.addEventListener("click", saveDayData);
    }

    const dayModalOverlay = document.querySelector(".day-modal-overlay");
    if (dayModalOverlay) {
      dayModalOverlay.removeEventListener("click", closeDayModal);
      dayModalOverlay.addEventListener("click", closeDayModal);
    }

    // Обработчик кнопки удаления
    const dayModalDelete = document.getElementById("dayModalDelete");
    if (dayModalDelete) {
      dayModalDelete.removeEventListener("click", deleteDayData);
      dayModalDelete.addEventListener("click", deleteDayData);
    }

    grid.removeEventListener("keydown", handleKeyDown);
    grid.addEventListener("keydown", handleKeyDown);

    document.removeEventListener("keydown", handleEscapeKey);
    document.addEventListener("keydown", handleEscapeKey);
  }

  // Старт
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ==========================================================================
  // 18. ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ (ДЛЯ ОТЛАДКИ)
  // ==========================================================================
  window.calendarNavigation = {
    prevMonth() {
      const newDate = new Date(state.currentDate);
      newDate.setMonth(newDate.getMonth() - 1);
      state.currentDate = newDate;
      updateHeader();
      renderCalendar();
      updateMainStats();
    },
    nextMonth() {
      const newDate = new Date(state.currentDate);
      newDate.setMonth(newDate.getMonth() + 1);
      state.currentDate = newDate;
      updateHeader();
      renderCalendar();
      updateMainStats();
    },
    today() {
      const today = new Date();
      state.currentDate = new Date(today);
      state.selectedDate = new Date(today);
      updateHeader();
      renderCalendar();
      updateMainStats();
    },
    openMonthPicker: openModal,
  };

  window.openDayModal = openDayModal; // для отладки

  // ==========================================================================
  // 19. СТРАНИЦА СВОДКИ
  // ==========================================================================
  const summaryPage = document.getElementById("summaryPage");
  const summaryPeriodText = document.getElementById("summaryPeriodText");
  const summaryTotalEarned = document.getElementById("summaryTotalEarned");
  const summaryTotalBonus = document.getElementById("summaryTotalBonus");
  const summaryTotalHours = document.getElementById("summaryTotalHours");
  const summaryPositionsList = document.getElementById("summaryPositionsList");
  const periodTabs = document.querySelectorAll(".summary-tab");

  let summaryCurrentDate = new Date(); // опорная дата (месяц/год)
  let summaryPeriod = "month"; // 'week', 'month', 'year'

  // Вычисление диапазона дат для текущего периода
  function getSummaryDateRange() {
    const year = summaryCurrentDate.getFullYear();
    const month = summaryCurrentDate.getMonth();
    const day = summaryCurrentDate.getDate();
    let start, end;

    switch (summaryPeriod) {
      case "week": {
        // Находим понедельник текущей недели
        const dayOfWeek = summaryCurrentDate.getDay(); // 0 = вс, 1 = пн ...
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(year, month, day - mondayOffset);
        start = new Date(monday);
        end = new Date(monday);
        end.setDate(monday.getDate() + 6);
        break;
      }
      case "month":
        start = new Date(year, month, 1);
        end = new Date(year, month + 1, 0);
        break;
      case "year":
        start = new Date(year, 0, 1);
        end = new Date(year, 11, 31);
        break;
    }
    return { start, end };
  }

  // Обновление текста периода
  function updatePeriodText() {
    if (!summaryPeriodText) return;
    const { start, end } = getSummaryDateRange();

    if (summaryPeriod === "week") {
      const startStr = start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
      const endStr = end.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
      summaryPeriodText.textContent = `${startStr} – ${endStr}`;
    } else if (summaryPeriod === "month") {
      summaryPeriodText.textContent = start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    } else {
      summaryPeriodText.textContent = start.getFullYear().toString();
    }
  }

  // Обновление доступности переключателей
  function updatePeriodTabs() {
    const now = new Date();
    const isCurrentMonth = summaryCurrentDate.getFullYear() === now.getFullYear() && summaryCurrentDate.getMonth() === now.getMonth();

    periodTabs.forEach((tab) => {
      const period = tab.dataset.period;

      // Обновляем disabled
      if (period === "week") {
        tab.disabled = !isCurrentMonth;
      } else {
        tab.disabled = false;
      }

      // Обновляем классы
      tab.classList.remove("summary-tab--active");
      if (period === summaryPeriod) {
        tab.classList.add("summary-tab--active");
      }

      // Обновляем класс disabled
      if (period === "week" && !isCurrentMonth) {
        tab.classList.add("summary-tab--disabled");
      } else {
        tab.classList.remove("summary-tab--disabled");
      }
    });
  }

  // Обработчик клика по табам
  function handleTabClick(e) {
    const tab = e.currentTarget;
    if (tab.disabled) return;
    const period = tab.dataset.period;
    if (period === summaryPeriod) return;

    if (period === "week") {
      // Если выбрана неделя, открываем модалку выбора недели
      openWeekPicker();
    } else {
      summaryPeriod = period;
      updateSummaryPage();
    }
  }

  // Инициализация табов
  function initSummaryTabs() {
    periodTabs.forEach((tab) => {
      tab.removeEventListener("click", handleTabClick);
      tab.addEventListener("click", handleTabClick);
    });
  }

  // Обновление карточек и списка позиций
  function updateSummaryData() {
    const { start, end } = getSummaryDateRange();
    let totalEarned = 0;
    let totalMinutes = 0;
    const positionsMap = new Map();

    // Загружаем настройки для процента премии
    let bonusPercent = 0; // по умолчанию 0
    const savedSettings = localStorage.getItem("settings");
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        bonusPercent = settings.bonusPercent || 0; // целое число (например, 15)
      } catch (e) {
        console.error("Ошибка загрузки настроек", e);
      }
    }

    // Перебираем дни от start до end включительно
    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      const saved = localStorage.getItem(dateKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          // Считаем заработок и минуты
          if (data.positions) {
            data.positions.forEach((pos) => {
              const id = pos.positionId;
              const quantity = pos.quantity || 0;
              const price = getPositionPrice(id) || 0;
              const earned = price * quantity;
              totalEarned += earned;

              // Для сводки по позициям
              if (positionsMap.has(id)) {
                const existing = positionsMap.get(id);
                existing.quantity += quantity;
                existing.earned += earned;
              } else {
                positionsMap.set(id, {
                  id,
                  quantity,
                  earned,
                  name: getPositionName(id),
                });
              }
            });
          }
          if (data.startTime && data.endTime) {
            const worked = calculateWorkedTime(data.startTime, data.endTime);
            totalMinutes += worked.hours * 60 + worked.minutes;
          }
        } catch (e) {
          // ignore
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Обновляем карточки
    if (summaryTotalEarned) {
      summaryTotalEarned.textContent = totalEarned.toLocaleString();
    }

    // Расчёт премии (процент от заработка)
    if (summaryTotalBonus) {
      if (bonusPercent > 0) {
        const bonus = Math.round(totalEarned * (bonusPercent / 100));
        summaryTotalBonus.textContent = bonus.toLocaleString();
      } else {
        summaryTotalBonus.textContent = "0";
      }
    }

    if (summaryTotalHours) {
      const hours = Math.floor(totalMinutes / 60);
      summaryTotalHours.textContent = hours.toString();
    }

    // Обновляем список позиций
    renderSummaryPositions(positionsMap);
  }

  // Отрисовка списка позиций
  function renderSummaryPositions(positionsMap) {
    if (!summaryPositionsList) return;

    summaryPositionsList.style.opacity = "0";
    setTimeout(() => {
      summaryPositionsList.style.transition = "opacity 0.2s ease";
      summaryPositionsList.style.opacity = "1";
    }, 10);

    const totalEarned = parseFloat(summaryTotalEarned.textContent.replace(/[^\d]/g, "")) || 0;
    const positions = Array.from(positionsMap.values()).sort((a, b) => b.earned - a.earned);

    // Улучшенное пустое состояние
    if (positions.length === 0) {
      summaryPositionsList.innerHTML = `
      <div class="summary-positions__empty">
        <div class="summary-positions__empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="9" stroke="currentColor"/>
            <path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="summary-positions__empty-title">Нет данных за выбранный период</p>
        <p class="summary-positions__empty-text">Добавьте смены в календаре, чтобы увидеть статистику по позициям</p>
      </div>
    `;
      return;
    }

    let html = "";
    positions.forEach((pos, index) => {
      html += `
      <div class="summary-position-item" style="animation: slideIn 0.3s ease-out ${index * 0.05}s forwards; opacity:0; transform:translateY(10px);">
        <div class="summary-position-left">
          <div class="summary-position-icon">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M7.33333 6.84656L4.66667 2.22656" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7.33333 9.15332L4.66667 13.7733" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M8 14.6666V13.3333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M8 1.33325V2.66659" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9.33333 8H14.6667" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M11.3333 13.7735L10.6667 12.6201" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M11.3333 2.22656L10.6667 3.3799" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M1.33333 8H2.66667" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M13.7733 11.3334L12.62 10.6667" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M13.7733 4.66675L12.62 5.33341" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2.22667 11.3334L3.38 10.6667" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2.22667 4.66675L3.38 5.33341" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M8 9.33341C8.73638 9.33341 9.33333 8.73646 9.33333 8.00008C9.33333 7.2637 8.73638 6.66675 8 6.66675C7.26362 6.66675 6.66667 7.2637 6.66667 8.00008C6.66667 8.73646 7.26362 9.33341 8 9.33341Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="summary-position-name">${pos.name}</span>
        </div>
        
        <div class="summary-position-right">
          <span class="summary-position-quantity">×${pos.quantity.toLocaleString()}</span>
          <span class="summary-position-earned">${pos.earned.toLocaleString()} ₽</span>
        </div>
      </div>
    `;
    });

    summaryPositionsList.innerHTML = html;
  }

  // Главная функция обновления страницы сводки
  function updateSummaryPage() {
    if (!summaryPage || summaryPage.style.display !== "flex") {
      return;
    }

    updatePeriodText();
    updatePeriodTabs();
    updateSummaryData();
    updateSummaryChart();
  }

  // Установка месяца для сводки (вызывается из confirmSelection)
  function setSummaryMonth(year, month) {
    summaryCurrentDate = new Date(year, month, 1);
    // Если текущий период был "week" и выбран не текущий месяц – переключаем на "month"
    const now = new Date();
    if (summaryPeriod === "week" && (year !== now.getFullYear() || month !== now.getMonth())) {
      summaryPeriod = "month";
    }
    updateSummaryPage();
  }

  // Обработчик открытия модалки выбора месяца для сводки
  function openSummaryMonthPicker() {
    state.tempMonth = summaryCurrentDate.getMonth();
    state.tempYear = summaryCurrentDate.getFullYear();

    fillMonthWheel();
    fillYearWheel();

    setTimeout(() => {
      setWheelPosition("month", state.tempMonth);
      setWheelPosition("year", state.tempYear);
    }, 50);

    isSummaryMonthPicker = true;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  let chartInstance = null;

  function updateSummaryChart() {
    const canvas = document.getElementById("summaryChart");
    if (!canvas) return;

    // Получаем данные за текущий и прошлый месяцы (с учётом выбранного периода)
    const currentYear = summaryCurrentDate.getFullYear();
    const currentMonth = summaryCurrentDate.getMonth();

    // Определяем "прошлый период" в зависимости от выбранного периода
    let prevYear = currentYear;
    let prevMonth = currentMonth;
    let prevLabel = "";

    switch (summaryPeriod) {
      case "week": {
        // Для недели: показываем предыдущую неделю
        const prevDate = new Date(summaryCurrentDate);
        prevDate.setDate(prevDate.getDate() - 7);
        prevYear = prevDate.getFullYear();
        prevMonth = prevDate.getMonth();
        const prevDay = prevDate.getDate();
        const weekStart = new Date(prevYear, prevMonth, prevDay);
        const weekEnd = new Date(prevYear, prevMonth, prevDay + 6);
        prevLabel = `${weekStart.getDate()}-${weekEnd.getDate()} ${MONTH_NAMES_GENITIVE[prevMonth]}`;
        break;
      }
      case "month":
        // Для месяца: предыдущий месяц
        prevMonth = currentMonth - 1;
        if (prevMonth < 0) {
          prevMonth = 11;
          prevYear = currentYear - 1;
        }
        prevLabel = `${MONTH_NAMES_GENITIVE[prevMonth]} ${prevYear}`;
        break;
      case "year":
        // Для года: предыдущий год
        prevYear = currentYear - 1;
        prevLabel = prevYear.toString();
        break;
    }

    // Функция сбора данных за период
    function getPeriodData(year, month, period) {
      let total = 0;

      switch (period) {
        case "week": {
          // Для недели используем summaryCurrentDate как опорную
          const startDate = new Date(summaryCurrentDate);
          if (year !== currentYear || month !== currentMonth) {
            // Если это прошлая неделя, сдвигаем
            startDate.setDate(startDate.getDate() - 7);
          }
          for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const key = formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());
            const saved = localStorage.getItem(key);
            if (saved) {
              try {
                const data = JSON.parse(saved);
                if (data.positions) {
                  data.positions.forEach((p) => {
                    total += (getPositionPrice(p.positionId) || 0) * (p.quantity || 0);
                  });
                }
              } catch (e) {}
            }
          }
          break;
        }
        case "month": {
          // Для месяца: все дни месяца
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          for (let day = 1; day <= daysInMonth; day++) {
            const key = formatDateKey(year, month, day);
            const saved = localStorage.getItem(key);
            if (saved) {
              try {
                const data = JSON.parse(saved);
                if (data.positions) {
                  data.positions.forEach((p) => {
                    total += (POSITION_PRICES[p.positionId] || 0) * (p.quantity || 0);
                  });
                }
              } catch (e) {}
            }
          }
          break;
        }
        case "year": {
          // Для года: все месяцы года
          for (let m = 0; m < 12; m++) {
            const daysInMonth = new Date(year, m + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
              const key = formatDateKey(year, m, day);
              const saved = localStorage.getItem(key);
              if (saved) {
                try {
                  const data = JSON.parse(saved);
                  if (data.positions) {
                    data.positions.forEach((p) => {
                      total += (POSITION_PRICES[p.positionId] || 0) * (p.quantity || 0);
                    });
                  }
                } catch (e) {}
              }
            }
          }
          break;
        }
      }
      return total;
    }

    // Получаем данные для текущего и прошлого периода
    const currentTotal = getPeriodData(currentYear, currentMonth, summaryPeriod);
    const prevTotal = getPeriodData(prevYear, prevMonth, summaryPeriod);

    // Формируем подписи для текущего периода
    let currentLabel = "";
    switch (summaryPeriod) {
      case "week": {
        const start = new Date(summaryCurrentDate);
        const end = new Date(summaryCurrentDate);
        end.setDate(end.getDate() + 6);
        currentLabel = `${start.getDate()}-${end.getDate()} ${MONTH_NAMES_GENITIVE[currentMonth]}`;
        break;
      }
      case "month":
        currentLabel = `${MONTH_NAMES_GENITIVE[currentMonth]} ${currentYear}`;
        break;
      case "year":
        currentLabel = currentYear.toString();
        break;
    }

    // Проверяем, есть ли данные
    const hasData = currentTotal > 0 || prevTotal > 0;

    // Если данных нет - показываем плейсхолдер
    if (!hasData) {
      showChartPlaceholder();
      return;
    }

    // Если есть данные - показываем диаграмму
    showChart(canvas, currentTotal, prevTotal, currentLabel, prevLabel);
  }

  // Функция для отображения плейсхолдера
  function showChartPlaceholder() {
    const canvas = document.getElementById("summaryChart");
    if (!canvas) return;

    // Уничтожаем старую диаграмму, если была
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    // Прячем canvas
    canvas.style.display = "none";

    // Создаём или показываем плейсхолдер
    let placeholder = document.querySelector(".summary-chart-placeholder");
    const chartContainer = canvas.parentNode;

    if (!placeholder) {
      placeholder = document.createElement("div");
      placeholder.className = "summary-chart-placeholder";
      chartContainer.appendChild(placeholder);
    }

    placeholder.innerHTML = `
    <div class="summary-chart-placeholder-content">
      <div class="summary-chart-placeholder-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 12C21 13.2 20.5 14.2 19.7 15.1C18.9 15.9 17.8 16.5 16.5 16.8C15.2 17.1 13.8 17.1 12.1 16.9" stroke="currentColor" stroke-linecap="round"/>
          <path d="M9 17C7.5 16.5 6.2 15.7 5.1 14.9C3.2 13.5 2 11.8 2 10C2 7.2 5.8 5 10 5C11.5 5 13 5.2 14.3 5.7" stroke="currentColor" stroke-linecap="round"/>
          <path d="M18 5L22 9L18 13" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M22 5L18 9L22 13" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <p class="summary-chart-placeholder-title">Нет данных для диаграммы</p>
      <p class="summary-chart-placeholder-text">Добавьте смены в календаре, чтобы увидеть сравнение с прошлым периодом</p>
    </div>
  `;

    placeholder.style.display = "flex";
  }

  // Функция для отображения диаграммы
  function showChart(canvas, currentTotal, prevTotal, currentLabel, prevLabel) {
    // Показываем canvas и прячем плейсхолдер
    canvas.style.display = "block";
    const placeholder = document.querySelector(".summary-chart-placeholder");
    if (placeholder) {
      placeholder.style.display = "none";
    }

    if (chartInstance) chartInstance.destroy();

    // Находим максимальное значение для масштабирования
    const maxValue = Math.max(currentTotal, prevTotal, 1);

    chartInstance = new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["Заработано"],
        datasets: [
          {
            label: currentLabel,
            data: [currentTotal],
            backgroundColor: "#6D9F71",
            borderRadius: 8,
            barPercentage: 0.5,
            categoryPercentage: 0.7,
          },
          {
            label: prevLabel,
            data: [prevTotal],
            backgroundColor: "rgba(109, 159, 113, 0.3)",
            borderRadius: 8,
            barPercentage: 0.5,
            categoryPercentage: 0.7,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            left: 0,
            right: 16,
            top: 4,
            bottom: 8,
          },
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "start",
            labels: {
              color: "#E9E9E9",
              font: {
                family: "Google Sans",
                size: 12,
                weight: "500",
              },
              usePointStyle: true,
              pointStyle: "rectRounded",
              boxWidth: 16,
              boxHeight: 10,
              padding: 8,
            },
          },
          tooltip: {
            backgroundColor: "#2C2C2C",
            titleColor: "#E9E9E9",
            titleFont: {
              family: "Google Sans",
              size: 12,
              weight: "500",
            },
            bodyColor: "#A0A0A0",
            bodyFont: {
              family: "Google Sans",
              size: 11,
            },
            borderColor: "#6D9F71",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                return `${ctx.raw.toLocaleString()} ₽`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              color: "rgba(233,233,233,0.1)",
              drawBorder: false,
            },
            border: { display: false },
            min: 0,
            max: maxValue * 1.15,
            ticks: {
              color: "#A0A0A0",
              font: {
                family: "Google Sans",
                size: 11,
              },
              padding: 6,
              callback: (val) => {
                if (val >= 1e6) return Math.round(val / 1e6) + "M";
                if (val >= 1e3) return Math.round(val / 1e3) + "K";
                return Math.round(val);
              },
              stepSize: maxValue / 4,
            },
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              display: false,
            },
          },
        },
        barThickness: 24,
        maxBarThickness: 28,
        grouped: true,
      },
    });
  }

  // Инициализация табов (вызываем один раз)
  initSummaryTabs();

  // ==========================================================================
  // 19.5 МОДАЛКА ВЫБОРА НЕДЕЛИ
  // ==========================================================================
  const weekPickerModal = document.getElementById("weekPickerModal");
  const weekPickerClose = document.getElementById("weekPickerClose");
  const weekPickerConfirm = document.getElementById("weekPickerConfirm");
  const weekPickerOverlay = document.querySelector(".week-picker-overlay");
  const weekPickerList = document.getElementById("weekPickerList");

  let selectedWeekIndex = 0;
  let weeksInMonth = [];

  // Функция получения недель в месяце
  function getWeeksInMonth(year, month) {
    const weeks = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Находим первый понедельник месяца или начало месяца
    let startDate = new Date(firstDay);
    const dayOfWeek = startDate.getDay(); // 0 = вс, 1 = пн ...
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(firstDay.getDate() - mondayOffset);

    let weekNumber = 1;
    let currentDate = new Date(startDate);

    while (currentDate <= lastDay || currentDate.getMonth() === month) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(currentDate.getDate() + 6);

      // Проверяем, есть ли дни в текущем месяце
      if (weekEnd >= firstDay || weekStart <= lastDay) {
        weeks.push({
          number: weekNumber,
          start: new Date(weekStart),
          end: new Date(weekEnd),
        });
        weekNumber++;
      }

      currentDate.setDate(currentDate.getDate() + 7);

      // Защита от бесконечного цикла
      if (weekNumber > 6) break;
    }

    return weeks;
  }

  // Заполнение списка недель
  function fillWeekList() {
    const year = summaryCurrentDate.getFullYear();
    const month = summaryCurrentDate.getMonth();

    weeksInMonth = getWeeksInMonth(year, month);

    let html = "";
    weeksInMonth.forEach((week, index) => {
      const startStr = week.start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
      const endStr = week.end.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

      html += `
      <div class="week-picker-item ${index === selectedWeekIndex ? "selected" : ""}" data-week-index="${index}">
        <span class="week-picker-item-number">${week.number}</span>
        <span class="week-picker-item-dates">${startStr} – ${endStr}</span>
      </div>
    `;
    });

    weekPickerList.innerHTML = html;

    // Добавляем обработчики клика на элементы
    document.querySelectorAll(".week-picker-item").forEach((item) => {
      item.addEventListener("click", () => {
        document.querySelectorAll(".week-picker-item").forEach((el) => el.classList.remove("selected"));
        item.classList.add("selected");
        selectedWeekIndex = parseInt(item.dataset.weekIndex);
      });
    });
  }

  // Открытие модалки выбора недели
  function openWeekPicker() {
    if (!weekPickerModal) return;

    fillWeekList();
    weekPickerModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  // Закрытие модалки недели
  function closeWeekPicker() {
    if (!weekPickerModal) return;
    weekPickerModal.classList.remove("active");
    document.body.style.overflow = "";
  }

  // Подтверждение выбора недели
  function confirmWeekSelection() {
    if (weeksInMonth[selectedWeekIndex]) {
      const week = weeksInMonth[selectedWeekIndex];
      summaryCurrentDate = new Date(week.start); // Устанавливаем дату на начало выбранной недели
      summaryPeriod = "week";
      updateSummaryPage();
    }
    closeWeekPicker();
  }

  // Обработчики для модалки недели
  if (weekPickerClose) {
    weekPickerClose.addEventListener("click", closeWeekPicker);
  }

  if (weekPickerConfirm) {
    weekPickerConfirm.addEventListener("click", confirmWeekSelection);
  }

  if (weekPickerOverlay) {
    weekPickerOverlay.addEventListener("click", closeWeekPicker);
  }

  // ==========================================================================
  // 20. СТРАНИЦА СПРАВОЧНИКА
  // ==========================================================================
  const referencePage = document.getElementById("referencePage");
  const referenceList = document.getElementById("referenceList");
  const addReferenceBtn = document.getElementById("addReferenceBtn");

  // Модалка позиции
  const positionModal = document.getElementById("positionModal");
  const positionModalTitle = document.getElementById("positionModalTitle");
  const positionModalClose = document.getElementById("positionModalClose");
  const positionModalCancel = document.getElementById("positionModalCancel");
  const positionModalDelete = document.getElementById("positionModalDelete");
  const positionModalSave = document.getElementById("positionModalSave");
  const positionNameInput = document.getElementById("positionNameInput");
  const positionPriceInput = document.getElementById("positionPriceInput");
  const positionModalOverlay = document.querySelector(".position-modal-overlay");

  // Состояние редактирования
  let editingPositionId = null;

  // Для определения двойного клика
  let referenceClickTimer = null;
  const REFERENCE_DOUBLE_CLICK_DELAY = 250;

  // ========== ОБЪЯВЛЯЕМ POSITIONS ЗДЕСЬ ==========
  let positions = []; // ← ВАЖНО!

  // ========== ФУНКЦИИ ДЛЯ РАБОТЫ С ХРАНИЛИЩЕМ ==========
  function loadPositions() {
    const saved = localStorage.getItem("positions");
    if (saved) {
      try {
        positions = JSON.parse(saved); // ← positions не объявлена!
      } catch (e) {
        console.error("Ошибка загрузки позиций", e);
        positions = [];
      }
    } else {
      positions = [
        { id: 1, name: "Гайка М8", price: 1240 },
        { id: 2, name: "Гайка М10", price: 850 },
        { id: 3, name: "Гайка М12", price: 2100 },
        { id: 4, name: "Гайка М16", price: 560 },
      ];
      savePositions();
    }
  }

  // Сохранение в localStorage
  function savePositions() {
    localStorage.setItem("positions", JSON.stringify(positions));
  }

  function normalizePrice(input) {
    // Заменяем запятую на точку и удаляем все пробелы
    const normalized = input.replace(/,/g, ".").replace(/\s/g, "");
    const price = parseFloat(normalized);

    // Проверяем, что получилось число
    if (isNaN(price) || price < 0) return null;

    // Округляем до 2 знаков (для копеек)
    return Math.round(price * 100) / 100;
  }

  function formatPrice(price) {
    // Форматируем цену с разделителями тысяч
    return price.toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  // Обработчик клика по элементу (для определения двойного)
  function handleReferenceItemClick(e) {
    const item = e.currentTarget;
    const id = parseInt(item.dataset.id);

    // Если был таймер — это двойной клик
    if (referenceClickTimer) {
      clearTimeout(referenceClickTimer);
      referenceClickTimer = null;
      // При двойном клике открываем модалку редактирования
      openEditPositionModal(id);
      return;
    }

    // Ставим таймер для определения двойного клика
    referenceClickTimer = setTimeout(() => {
      referenceClickTimer = null;
      // Здесь можно добавить действие для одинарного клика, если нужно
      // Например, выделение элемента
    }, REFERENCE_DOUBLE_CLICK_DELAY);
  }

  // Отрисовка списка справочника
  function renderReferenceList() {
    if (!referenceList) {
      return;
    }

    let html = "";
    positions.forEach((pos, index) => {
      html += `
      <div class="reference-item" data-id="${pos.id}" style="animation-delay: ${index * 0.05}s">
        <div class="reference-item-icon">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path d="M7.33333 6.84656L4.66667 2.22656" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7.33333 9.15332L4.66667 13.7733" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 14.6666V13.3333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 1.33325V2.66659" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9.33333 8H14.6667" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11.3333 13.7735L10.6667 12.6201" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11.3333 2.22656L10.6667 3.3799" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M1.33333 8H2.66667" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13.7733 11.3334L12.62 10.6667" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13.7733 4.66675L12.62 5.33341" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2.22667 11.3334L3.38 10.6667" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2.22667 4.66675L3.38 5.33341" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 9.33341C8.73638 9.33341 9.33333 8.73646 9.33333 8.00008C9.33333 7.2637 8.73638 6.66675 8 6.66675C7.26362 6.66675 6.66667 7.2637 6.66667 8.00008C6.66667 8.73646 7.26362 9.33341 8 9.33341Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="reference-item-name">${pos.name}</span>
        <span class="reference-item-price">${formatPrice(pos.price)} ₽</span>
      </div>
    `;
    });

    referenceList.innerHTML = html;

    // Добавляем обработчики клика на элементы (для определения двойного)
    attachClickHandlers();
  }

  // Функция для прикрепления обработчиков клика
  function attachClickHandlers() {
    const items = document.querySelectorAll(".reference-item");

    items.forEach((item) => {
      // Удаляем старый обработчик, чтобы не было дублей
      item.removeEventListener("click", handleReferenceItemClick);
      // Добавляем новый
      item.addEventListener("click", handleReferenceItemClick);
    });
  }

  // Открытие модалки для добавления
  function openAddPositionModal() {
    editingPositionId = null;
    positionModalTitle.textContent = "Новая позиция";
    positionNameInput.value = "";
    positionPriceInput.value = "";
    positionModalDelete.style.display = "none";
    positionModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  // Открытие модалки для редактирования
  function openEditPositionModal(id) {
    const position = positions.find((p) => p.id === id);
    if (!position) {
      return;
    }

    editingPositionId = id;
    positionModalTitle.textContent = "Редактировать";
    positionNameInput.value = position.name;
    positionPriceInput.value = position.price;
    positionModalDelete.style.display = "block";
    positionModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  // Закрытие модалки
  function closePositionModal() {
    positionModal.classList.remove("active");
    document.body.style.overflow = "";
    editingPositionId = null;
  }

  // Сохранение позиции
  function savePosition() {
    const name = positionNameInput.value.trim();
    const price = normalizePrice(positionPriceInput.value);

    if (!name) {
      alert("Введите название");
      return;
    }
    if (price === null) {
      alert("Введите корректную цену");
      return;
    }

    if (editingPositionId) {
      const position = positions.find((p) => p.id === editingPositionId);
      if (position) {
        position.name = name;
        position.price = price;
      }
    } else {
      const newId = positions.length > 0 ? Math.max(...positions.map((p) => p.id)) + 1 : 1;
      positions.push({ id: newId, name, price });
    }

    // Если модалка дня открыта, обновляем позиции в ней
    if (dayModal.classList.contains("active")) {
      renderDayModalPositions();
    }

    savePositions(); // <-- СОХРАНЯЕМ В STORAGE
    renderReferenceList();
    closePositionModal();
  }

  // Удаление позиции
  function deletePosition() {
    if (!editingPositionId) return;

    positions = positions.filter((p) => p.id !== editingPositionId);

    // Если модалка дня открыта, обновляем позиции в ней
    if (dayModal.classList.contains("active")) {
      renderDayModalPositions();
    }

    savePositions(); // <-- СОХРАНЯЕМ В STORAGE
    renderReferenceList();
    closePositionModal();
  }

  // Обработчики для модалки
  if (addReferenceBtn) {
    addReferenceBtn.addEventListener("click", openAddPositionModal);
  } else {
  }

  if (positionModalClose) {
    positionModalClose.addEventListener("click", closePositionModal);
  }
  if (positionModalCancel) {
    positionModalCancel.addEventListener("click", closePositionModal);
  }
  if (positionModalDelete) {
    positionModalDelete.addEventListener("click", deletePosition);
  }
  if (positionModalSave) {
    positionModalSave.addEventListener("click", savePosition);
  }
  if (positionModalOverlay) {
    positionModalOverlay.addEventListener("click", closePositionModal);
  }

  // ========== ИНИЦИАЛИЗАЦИЯ ==========
  loadPositions(); // 1. Загружаем
  renderReferenceList(); // 2. Отрисовываем

  // ==========================================================================
  // 21. СТРАНИЦА НАСТРОЕК
  // ==========================================================================
  const settingsPage = document.getElementById("settingsPage");

  // Элементы для редактирования
  const bonusPercentValue = document.querySelector('[data-key="bonusPercent"]');
  const teamSizeValue = document.querySelector('[data-key="teamSize"]');
  const feedbackInput = document.querySelector(".settings-feedback-input");
  const feedbackSendBtn = document.getElementById("feedbackSendBtn");

  // Загрузка настроек из localStorage
  let settings = {
    bonusPercent: 15,
    teamSize: 2,
  };

  function loadSettings() {
    const saved = localStorage.getItem("settings");
    if (saved) {
      try {
        settings = JSON.parse(saved);
      } catch (e) {
        console.error("Ошибка загрузки настроек", e);
      }
    }
    updateSettingsDisplay();

    // Добавляем отображение версии
    const versionElement = document.querySelector(".settings-item-version");
    if (versionElement) {
      versionElement.textContent = APP_VERSION;
    }
  }

  function saveSettings() {
    localStorage.setItem("settings", JSON.stringify(settings));
  }

  function updateSettingsDisplay() {
    if (bonusPercentValue) {
      const textSpan = bonusPercentValue.querySelector(".settings-item-value-text");
      if (textSpan) textSpan.textContent = settings.bonusPercent;
    }
    if (teamSizeValue) {
      const textSpan = teamSizeValue.querySelector(".settings-item-value-text");
      if (textSpan) textSpan.textContent = settings.teamSize;
    }
  }

  // Редактирование значений
  function startValueEditing(element, key, type = "int") {
    // Если уже редактируется — выходим
    if (element.querySelector("input")) return;

    const textSpan = element.querySelector(".settings-item-value-text");
    const currentValue = settings[key];

    // Скрываем текст
    textSpan.style.display = "none";

    // Создаём input
    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.min = type === "float" ? 0 : 1;
    input.step = 1;
    input.value = currentValue;
    input.className = "settings-item-value-input";

    // Добавляем input
    element.appendChild(input);
    input.focus();

    // Обработчик потери фокуса
    input.addEventListener("blur", () => {
      finishValueEditing(element, key, input.value, type, textSpan);
    });

    // Обработчик Enter
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
    });
  }

  function finishValueEditing(element, key, newValue, type, textSpan) {
    let val;
    if (key === "bonusPercent") {
      val = parseInt(newValue, 10);
      if (isNaN(val) || val < 0) val = 0;
    } else {
      val = type === "float" ? parseFloat(newValue) : parseInt(newValue, 10);
      if (isNaN(val) || val < (type === "float" ? 0 : 1)) {
        val = settings[key];
      }
    }

    settings[key] = val;
    saveSettings();

    // Удаляем input
    const input = element.querySelector("input");
    if (input) input.remove();

    // Показываем текст с новым значением
    textSpan.textContent = val;
    textSpan.style.display = "block";
  }

  // Функция обновления состояния кнопки отправки
  function updateFeedbackButtonState() {
    if (!feedbackSendBtn || !feedbackInput) return;

    if (feedbackInput.value.trim().length > 0) {
      feedbackSendBtn.classList.add("active");
      feedbackSendBtn.disabled = false;
    } else {
      feedbackSendBtn.classList.remove("active");
      feedbackSendBtn.disabled = true;
    }
  }

  // Функция отправки обратной связи в Google Forms
  function sendFeedback() {
    const message = feedbackInput.value.trim();
    if (!message) return;

    // ВАШИ ДАННЫЕ ИЗ GOOGLE FORMS
    const FORM_ID = "1FAIpQLSfZRjWdS8r7E4ihzPpyfkKkdvCrSJyFKsYaphbWR_5Gbj_LEA";
    const FIELD_ID = "entry.1722024578"; // этот ID остаётся тем же

    // Отправляем данные в Google Forms
    fetch(`https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`, {
      method: "POST",
      mode: "no-cors", // обязательно для Google Forms
      body: new URLSearchParams({
        [FIELD_ID]: message,
      }),
    }).catch((error) => console.log("Отправка выполнена (ответ не ожидается):", error));

    // Очищаем поле
    feedbackInput.value = "";
    localStorage.removeItem("feedback");
    updateFeedbackButtonState();

    // Показываем галочку
    const originalHtml = feedbackSendBtn.innerHTML;
    feedbackSendBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M16.6667 5L7.5 14.1667L3.33333 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

    setTimeout(() => {
      feedbackSendBtn.innerHTML = originalHtml;
    }, 2000);
  }

  // Обработчики клика на редактируемые поля
  if (bonusPercentValue) {
    bonusPercentValue.addEventListener("click", () => {
      startValueEditing(bonusPercentValue, "bonusPercent", "int");
    });
  }

  if (teamSizeValue) {
    teamSizeValue.addEventListener("click", () => {
      startValueEditing(teamSizeValue, "teamSize", "int");
    });
  }

  // Обработчики для обратной связи
  if (feedbackInput) {
    feedbackInput.addEventListener("input", updateFeedbackButtonState);

    let feedbackTimer;
    feedbackInput.addEventListener("input", () => {
      clearTimeout(feedbackTimer);
      feedbackTimer = setTimeout(() => {
        localStorage.setItem("feedback", feedbackInput.value);
      }, 500);
    });

    const savedFeedback = localStorage.getItem("feedback");
    if (savedFeedback) {
      feedbackInput.value = savedFeedback;
    }

    feedbackInput.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (feedbackInput.value.trim().length > 0) {
          sendFeedback();
        }
      }
    });
  }

  if (feedbackSendBtn) {
    feedbackSendBtn.addEventListener("click", sendFeedback);
    updateFeedbackButtonState();
  }

  // Баннер
  const banner = document.querySelector(".settings-banner");
  if (banner) {
    banner.addEventListener("click", () => {});
  }

  loadSettings();

  // ==========================================================================
  // 22. НАВИГАЦИОННАЯ ПАНЕЛЬ
  // ==========================================================================
  const navButtons = document.querySelectorAll(".app-nav__button");

  // Состояние навигации
  let currentPage = "home"; // home, summary, reference, settings

  // Функция переключения страниц
  function switchPage(page) {
    // Снимаем активный класс
    navButtons.forEach((btn) => btn.classList.remove("active"));
    const activeButton = document.querySelector(`[data-page="${page}"]`);
    if (activeButton) activeButton.classList.add("active");

    // Прячем все страницы
    const calendarSection = document.querySelector(".calendar-section");
    const statsSection = document.querySelector(".stats-section");
    const contextPanel = document.getElementById("dayContextPanel");

    if (calendarSection) calendarSection.style.display = "none";
    if (statsSection) statsSection.style.display = "none";
    if (contextPanel) contextPanel.style.display = "none";
    if (summaryPage) summaryPage.style.display = "none";
    if (referencePage) referencePage.style.display = "none";
    if (settingsPage) settingsPage.style.display = "none";

    // Убираем специальные классы с main
    const appMain = document.querySelector(".app-main");
    if (appMain) {
      appMain.classList.remove("app-main--home", "app-main--summary");
    }

    // ========== МЕНЯЕМ ТЕКСТ В ШАПКЕ ==========
    const monthElement = document.querySelector(".app-header__month");

    // Показываем нужную страницу
    switch (page) {
      case "home":
        if (calendarSection) calendarSection.style.display = "block";
        if (statsSection) statsSection.style.display = "block";
        if (contextPanel) contextPanel.style.display = "flex";
        if (appMain) appMain.classList.add("app-main--home");
        // Восстанавливаем месяц
        if (monthElement) {
          const year = state.currentDate.getFullYear();
          const month = state.currentDate.getMonth();
          monthElement.textContent = `${MONTH_NAMES[month]} ${year}`;
        }
        break;

      case "summary":
        if (summaryPage) {
          summaryPage.style.display = "flex";
          updateSummaryPage();
          if (appMain) appMain.classList.add("app-main--summary");
          // На сводке показываем выбранный период
          if (monthElement) {
            // Можно оставить как есть или тоже менять
            const year = summaryCurrentDate.getFullYear();
            const month = summaryCurrentDate.getMonth();
            monthElement.textContent = `${MONTH_NAMES[month]} ${year}`;
          }
        }
        break;

      case "reference":
        if (referencePage) {
          referencePage.style.display = "flex";
          if (appMain) appMain.classList.add("app-main--reference");
          // ========== МЕНЯЕМ НА "СПРАВОЧНИК" ==========
          if (monthElement) {
            monthElement.textContent = "Справочник";
          }
        }
        break;

      case "settings":
        if (settingsPage) {
          settingsPage.style.display = "flex";
          if (appMain) appMain.classList.add("app-main--settings");
          if (monthElement) {
            monthElement.textContent = "Настройки";
          }
        }
        break;
    }

    currentPage = page;
  }

  // Добавляем data-атрибуты к кнопкам
  if (navButtons.length) {
    const pages = ["home", "summary", "reference", "settings"];
    navButtons.forEach((btn, index) => {
      btn.setAttribute("data-page", pages[index]);

      btn.addEventListener("click", () => {
        switchPage(pages[index]);
      });
    });
  }

  // Анимация появления навигации
  function animateNavButton(button) {
    button.style.transition = "all 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.1)";
  }

  navButtons.forEach((btn) => animateNavButton(btn));

  function confirmSelection() {
    if (isSummaryMonthPicker) {
      // Выбор месяца для сводки
      setSummaryMonth(state.tempYear, state.tempMonth);
      isSummaryMonthPicker = false;
    } else {
      // Обычная логика для главной
      state.currentDate = new Date(state.tempYear, state.tempMonth, 1);
      const selectedDay = state.selectedDate.getDate();
      const lastDayOfNewMonth = new Date(state.tempYear, state.tempMonth + 1, 0).getDate();
      if (selectedDay <= lastDayOfNewMonth) {
        state.selectedDate = new Date(state.tempYear, state.tempMonth, selectedDay);
      } else {
        state.selectedDate = new Date(state.tempYear, state.tempMonth, lastDayOfNewMonth);
      }
      updateHeader();
      renderCalendar();
      if (typeof updateMainStats === "function") updateMainStats();
    }
    closeModal();
  }
})();
