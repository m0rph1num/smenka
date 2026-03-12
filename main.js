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
  const MONTH_NAMES = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];

  const MONTH_NAMES_GENITIVE = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];

  const TOTAL_CELLS = 42;
  const ANIMATION_DURATION = 300;

  // ==========================================================================
  // 4.1 ВЕРСИЯ ПРИЛОЖЕНИЯ
  // ==========================================================================
  const APP_VERSION = "1.1.0";

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

  let clickTimer = null;
  const DOUBLE_CLICK_DELAY = 250;
  let isSummaryMonthPicker = false;
  let wheelHandlerMonth, wheelHandlerYear;
  let activeTimeInput = null;
  let timePickerHourHandler, timePickerMinuteHandler;
  let closeDayModalTimer = null;

  // ==========================================================================
  // 6. УТИЛИТЫ
  // ==========================================================================
  function isWeekend(year, month, day) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  function formatDateKey(year, month, day) {
    return `${year}-${month + 1}-${day}`; // +1 чтобы месяц был 1-12
  }

  function isDayFilled(year, month, day) {
    const dateKey = formatDateKey(year, month, day);
    const saved = localStorage.getItem(dateKey);
    if (!saved) return false;

    try {
      const data = JSON.parse(saved);
      const hasRealPositions =
        data.positions && data.positions.length > 0 && data.positions.some((pos) => pos.quantity > 0);
      return hasRealPositions;
    } catch (e) {
      return false;
    }
  }

  // ==========================================================================
  // 6.1 ФОРМАТИРОВАНИЕ СУММ (БЕЗ КОПЕЕК)
  // ==========================================================================

  function formatAmount(amount) {
    if (amount === undefined || amount === null) return "0";
    return Math.round(amount).toLocaleString("ru-RU");
  }

  // ==========================================================================
  // 7. ГЕНЕРАЦИЯ ДНЕЙ КАЛЕНДАРЯ
  // ==========================================================================
  function generateCalendarDays(year, month) {
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const days = [];

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

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        month,
        year,
        isCurrentMonth: true,
        isWeekend: isWeekend(year, month, i),
      });
    }

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

      if (dayInfo.isCurrentMonth && isDayFilled(dayInfo.year, dayInfo.month, dayInfo.day)) {
        cell.classList.add("calendar-cell--filled");
      }

      if (
        dayInfo.isCurrentMonth &&
        dayInfo.day === state.selectedDate.getDate() &&
        dayInfo.month === state.selectedDate.getMonth() &&
        dayInfo.year === state.selectedDate.getFullYear()
      ) {
        cell.classList.add("calendar-cell--selected");
      }

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
  // 9. ОБРАБОТЧИКИ КАЛЕНДАРЯ
  // ==========================================================================
  function handleCalendarClick(event) {
    const cell = event.target.closest(".calendar-cell");
    if (!cell || cell.dataset.isCurrentMonth !== "true") return;

    document.querySelectorAll(".calendar-cell--selected").forEach((c) => c.classList.remove("calendar-cell--selected"));
    cell.classList.add("calendar-cell--selected");

    const year = parseInt(cell.dataset.year, 10);
    const month = parseInt(cell.dataset.month, 10);
    const day = parseInt(cell.dataset.day, 10);
    const selectedDate = new Date(year, month, day);

    state.selectedDate = selectedDate;
    state.selectedDateStr = selectedDate.toDateString();
    updateContextPanel(selectedDate);

    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      contextPanel?.classList.remove("active");
      openDayModal(selectedDate);
      return;
    }

    document.dispatchEvent(new CustomEvent("dateSelected", { detail: { date: selectedDate } }));

    clickTimer = setTimeout(() => {
      clickTimer = null;
    }, DOUBLE_CLICK_DELAY);
  }

  // ==========================================================================
  // 10. МОДАЛКА ВЫБОРА МЕСЯЦА
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
  }

  // ==========================================================================
  // 11. ТАЧ-СВАЙПЫ НА БАРАБАНАХ
  // ==========================================================================
  function setupWheelTouch(container, setPositionCallback, tempStateCallback) {
    let startY = 0;
    let startTranslate = 0;
    let currentIndex = 0;

    function getCurrentIndex() {
      const selected = container.querySelector(".selected");
      return selected ? Array.from(container.children).indexOf(selected) : 0;
    }

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
  // 12. ЗАПОЛНЕНИЕ БАРАБАНОВ
  // ==========================================================================
  function fillMonthWheel() {
    let html = "";
    MONTH_NAMES.forEach((month, index) => {
      html += `<div class="month-picker-wheel-item" data-value="${index}">${month}</div>`;
    });
    monthWheelItems.innerHTML = html;

    monthWheelItems.removeEventListener("wheel", wheelHandlerMonth);
    monthWheelItems.addEventListener("wheel", (wheelHandlerMonth = (e) => handleWheelScroll(e, "month")), {
      passive: false,
    });

    Array.from(monthWheelItems.children).forEach((item) => {
      item.addEventListener("click", () => {
        const value = parseInt(item.dataset.value, 10);
        setWheelPosition("month", value);
        state.tempMonth = value;
      });
    });
  }

  function fillYearWheel() {
    const currentYear = new Date().getFullYear();
    let html = "";
    for (let year = currentYear - 15; year <= currentYear + 15; year++) {
      html += `<div class="month-picker-wheel-item" data-value="${year}">${year}</div>`;
    }
    yearWheelItems.innerHTML = html;

    yearWheelItems.removeEventListener("wheel", wheelHandlerYear);
    yearWheelItems.addEventListener("wheel", (wheelHandlerYear = (e) => handleWheelScroll(e, "year")), {
      passive: false,
    });

    Array.from(yearWheelItems.children).forEach((item) => {
      item.addEventListener("click", () => {
        const value = parseInt(item.dataset.value, 10);
        setWheelPosition("year", value);
        state.tempYear = value;
      });
    });
  }

  // ==========================================================================
  // 12.1 КНОПКА СБРОСА К ТЕКУЩЕЙ ДАТЕ
  // ==========================================================================
  function resetToCurrentDate() {
    const today = new Date();
    state.tempMonth = today.getMonth();
    state.tempYear = today.getFullYear();
    setWheelPosition("month", state.tempMonth);
    setWheelPosition("year", state.tempYear);
  }

  const resetBtn = document.querySelector(".month-picker-button--reset");
  if (resetBtn) {
    resetBtn.removeEventListener("click", resetToCurrentDate);
    resetBtn.addEventListener("click", resetToCurrentDate);
  }

  // ==========================================================================
  // 13. МОДАЛКА ДНЯ
  // ==========================================================================
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
        earnedSpan.textContent = `${formatAmount(earned)} ₽`;
        total += earned;
      } else {
        earnedSpan.textContent = "0 ₽";
      }
    });
    return total;
  }

  function calculateWorkedTime(startTime, endTime) {
    if (!startTime || !endTime) return { hours: 0, minutes: 0 };
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    let startTotal = startHour * 60 + startMin;
    let endTotal = endHour * 60 + endMin;
    if (endTotal < startTotal) endTotal += 24 * 60;
    let diffMinutes = endTotal - startTotal;
    if (diffMinutes > 0) {
      diffMinutes = diffMinutes - 30;
      if (diffMinutes < 0) diffMinutes = 0;
    }
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return { hours, minutes };
  }

  function formatWorkedTime(time) {
    if (time.hours === 0 && time.minutes === 0) return "0ч";
    if (time.minutes === 0) return `${time.hours}ч`;
    return `${time.hours}:${time.minutes.toString().padStart(2, "0")}`;
  }

  function updateStats() {
    const totalEarned = calculateTotalEarned();
    const totalEarnedSpan = document.getElementById("totalEarnedValue");
    if (totalEarnedSpan) totalEarnedSpan.textContent = `${formatAmount(totalEarned)} ₽`;

    const workedTime = calculateWorkedTime(shiftStart.value, shiftEnd.value);
    const totalHoursSpan = document.getElementById("totalHoursValue");
    if (totalHoursSpan) totalHoursSpan.textContent = formatWorkedTime(workedTime);
  }

  function updateShiftTypeIcon() {
    const modalDayIcon = document.getElementById("modalShiftTypeDay");
    const modalNightIcon = document.getElementById("modalShiftTypeNight");
    const contextDayIcon = document.getElementById("contextShiftTypeDay");
    const contextNightIcon = document.getElementById("contextShiftTypeNight");
    const startHour = parseInt(shiftStart.value.split(":")[0]);
    const isDayShift = startHour >= 7 && startHour < 19;

    if (modalDayIcon && modalNightIcon) {
      if (isDayShift) {
        modalDayIcon.style.display = "flex";
        modalNightIcon.style.display = "none";
      } else {
        modalDayIcon.style.display = "none";
        modalNightIcon.style.display = "flex";
      }
    }

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

  function loadDayData(date) {
    if (!shiftStart || !shiftEnd) return;

    const dateKey = formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());
    const saved = localStorage.getItem(dateKey);
    const positionItems = document.querySelectorAll(".day-modal-position-item");

    // 1. СНАЧАЛА СБРАСЫВАЕМ ВСЁ В 0
    positionItems.forEach((item) => {
      const quantityInput = item.querySelector(".day-modal-quantity-input");
      if (quantityInput) quantityInput.value = "0";
    });

    // 2. Устанавливаем время по умолчанию
    shiftStart.value = "07:00";
    shiftEnd.value = "15:30";

    if (saved) {
      try {
        const data = JSON.parse(saved);

        // Устанавливаем сохранённое время
        if (data.startTime) shiftStart.value = data.startTime;
        if (data.endTime) shiftEnd.value = data.endTime;

        // Заполняем позиции
        if (data.positions && Array.isArray(data.positions)) {
          data.positions.forEach((posData, index) => {
            if (index < positionItems.length) {
              const item = positionItems[index];
              const select = item.querySelector(".day-modal-select");
              const quantityInput = item.querySelector(".day-modal-quantity-input");
              const positionExists = positions.some((p) => p.id == posData.positionId);

              if (select && quantityInput && positionExists && posData.quantity > 0) {
                select.value = posData.positionId;
                quantityInput.value = posData.quantity;
              }
            }
          });
        }
      } catch (e) {
        console.warn("Ошибка загрузки данных дня:", e);
      }
    }

    updateStats();
    updateShiftTypeIcon();
  }

  function setDefaultPlaceholders() {
    const positionItems = document.querySelectorAll(".day-modal-position-item");
    positionItems.forEach((item) => {
      const select = item.querySelector(".day-modal-select");
      const quantityInput = item.querySelector(".day-modal-quantity-input");

      if (select) {
        let placeholderOption = select.querySelector('option[value=""]');
        if (!placeholderOption) {
          placeholderOption = document.createElement("option");
          placeholderOption.value = "";
          placeholderOption.textContent = "— Выберите —";
          placeholderOption.disabled = true;
          placeholderOption.selected = true;
          select.prepend(placeholderOption);
        } else {
          placeholderOption.selected = true;
        }
      }
      if (quantityInput) quantityInput.value = "0";
    });
  }

  function saveDayData() {
    const date = state.selectedDate;
    if (!date) return;

    if (!validateTimeRangeWithFeedback(shiftStart.value, shiftEnd.value)) return;

    const dateKey = formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());
    const positionItems = document.querySelectorAll(".day-modal-position-item");
    const positions = [];

    positionItems.forEach((item) => {
      const select = item.querySelector(".day-modal-select");
      const quantityInput = item.querySelector(".day-modal-quantity-input");
      const quantity = validateQuantityInputWithFeedback(quantityInput);

      if (select && select.value && select.value !== "" && quantity > 0) {
        positions.push({ positionId: select.value, quantity });
      }
    });

    const data = {
      startTime: shiftStart.value || "",
      endTime: shiftEnd.value || "",
      positions,
      _synced: 0, // 0 = не синхронизировано
    };

    localStorage.setItem(dateKey, JSON.stringify(data));
    vibrate(40);
    updateMainStats();
    renderCalendar();
    closeDayModal();

    if (navigator.onLine) {
      syncAllData(); // сразу отправляем в облако
    } else {
      // Если нет интернета, данные уже в pendingQueue
      console.log("Данные сохранены локально, отправятся при появлении сети");
    }
  }

  function deleteDayData() {
    const date = state.selectedDate;
    if (!date) return;

    const dateKey = formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());
    localStorage.removeItem(dateKey);
    updateMainStats();
    renderCalendar();
    if (
      state.selectedDate &&
      state.selectedDate.getDate() === date.getDate() &&
      state.selectedDate.getMonth() === date.getMonth() &&
      state.selectedDate.getFullYear() === date.getFullYear()
    ) {
      updateContextPanel(date);
    }
    closeDayModal();
  }

  function initPositionListeners() {
    const positionItems = document.querySelectorAll(".day-modal-position-item");
    positionItems.forEach((item) => {
      const select = item.querySelector(".day-modal-select");
      const quantityInput = item.querySelector(".day-modal-quantity-input");

      if (select) select.addEventListener("change", updateStats);

      if (quantityInput) {
        quantityInput.addEventListener("input", (e) => {
          e.target.value = e.target.value.replace("-", "");
          updateStats();
        });
        quantityInput.addEventListener("blur", (e) => {
          validateQuantityInputWithFeedback(e.target);
          updateStats();
        });
        quantityInput.addEventListener("keydown", (e) => {
          if (e.key === "-" || e.key === "e" || e.key === "E") {
            e.preventDefault();
            vibrate(20);
            highlightError(e.target);
          }
        });
        quantityInput.setAttribute("inputmode", "numeric");
        quantityInput.setAttribute("pattern", "[0-9]*");
        quantityInput.setAttribute("min", "0");
        quantityInput.setAttribute("max", "10000");
      }
    });

    if (shiftStart && shiftEnd) {
      shiftStart.addEventListener("change", () => {
        validateTimeRangeWithFeedback(shiftStart.value, shiftEnd.value);
        updateShiftTypeIcon();
        updateStats();
      });
      shiftEnd.addEventListener("change", () => {
        validateTimeRangeWithFeedback(shiftStart.value, shiftEnd.value);
        updateShiftTypeIcon();
        updateStats();
      });
    }
  }

  function renderDayModalPositions() {
    const positionItems = document.querySelectorAll(".day-modal-position-item");

    positionItems.forEach((item) => {
      const select = item.querySelector(".day-modal-select");
      if (!select) return;

      // Сохраняем текущее выбранное значение (если есть)
      const currentValue = select.value;

      // Очищаем select
      select.innerHTML = "";

      // Добавляем опцию-плейсхолдер
      const placeholderOption = document.createElement("option");
      placeholderOption.value = "";
      placeholderOption.textContent = "— Выберите —";
      placeholderOption.disabled = true;
      placeholderOption.selected = true;
      select.appendChild(placeholderOption);

      // Добавляем позиции из справочника
      positions.forEach((pos) => {
        const option = document.createElement("option");
        option.value = pos.id;
        option.textContent = pos.name;
        select.appendChild(option);
      });

      // ВАЖНО: НЕ сбрасываем на плейсхолдер, если было сохранённое значение
      // Значение установится позже в loadDayData
    });
  }

  function openDayModal(date) {
    if (!dayModal) return;

    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    dayModalDate.textContent = `${day} ${MONTH_NAMES_GENITIVE[month]} ${year}`;
    const shortDateSpan = document.getElementById("dayModalDateShort");
    if (shortDateSpan) {
      shortDateSpan.textContent = `${day} ${MONTH_NAMES_GENITIVE[month]}`;
    }

    // ВАЖНО: Сначала строим селекты
    renderDayModalPositions();

    // ПОТОМ загружаем данные (внутри loadDayData теперь есть сброс количества)
    loadDayData(date);

    dayModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeDayModal() {
    if (!dayModal) return;
    if (closeDayModalTimer) {
      clearTimeout(closeDayModalTimer);
      closeDayModalTimer = null;
    }
    dayModal.classList.add("closing");
    closeDayModalTimer = setTimeout(() => {
      dayModal.classList.remove("active", "closing");
      document.body.style.overflow = "";
      closeDayModalTimer = null;
    }, ANIMATION_DURATION);
  }

  // ==========================================================================
  // 13.1 ВАЛИДАЦИЯ КОЛИЧЕСТВА
  // ==========================================================================
  function validateQuantityInput(input) {
    let value = parseInt(input.value, 10);
    if (isNaN(value) || value < 0) value = 0;
    if (value > 10000) value = 10000;
    input.value = value;
    return value;
  }

  // ==========================================================================
  // 13.2 ВАЛИДАЦИЯ ВРЕМЕНИ
  // ==========================================================================
  function validateTimeRange(startTime, endTime) {
    if (!startTime || !endTime) return true;
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    let startTotal = startHour * 60 + startMin;
    let endTotal = endHour * 60 + endMin;
    if (endTotal < startTotal && endTotal < 12 * 60) return false;
    return true;
  }

  // ==========================================================================
  // 13.4 ТАКТИЛЬНЫЙ ОТКЛИК
  // ==========================================================================
  function vibrate(pattern = 50) {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(pattern);
    }
  }

  function highlightError(element) {
    if (!element) return;
    element.classList.add("error");
    setTimeout(() => element.classList.remove("error"), 1500);
  }

  function validateTimeRangeWithFeedback(startTime, endTime) {
    if (!startTime || !endTime) return true;
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    let startTotal = startHour * 60 + startMin;
    let endTotal = endHour * 60 + endMin;
    if (endTotal < startTotal && endTotal > 6 * 60) {
      vibrate([50, 30, 50]);
      highlightError(shiftEnd);
      highlightError(shiftStart);
      return false;
    }
    return true;
  }

  function validateQuantityInputWithFeedback(input) {
    let value = parseInt(input.value, 10);
    let hadError = false;
    if (isNaN(value) || value < 0) {
      value = 0;
      hadError = true;
    }
    if (value > 10000) {
      value = 10000;
      hadError = true;
    }
    if (hadError) {
      vibrate(30);
      highlightError(input);
    }
    input.value = value;
    return value;
  }

  // ==========================================================================
  // 14. КОНТЕКСТНАЯ ПАНЕЛЬ
  // ==========================================================================
  const contextPanel = document.getElementById("dayContextPanel");
  const contextDateShort = document.getElementById("contextDateShort");
  const contextShiftTypeDay = document.getElementById("contextShiftTypeDay");
  const contextShiftTypeNight = document.getElementById("contextShiftTypeNight");
  const contextTotalEarned = document.getElementById("contextTotalEarned");
  const contextTotalHours = document.getElementById("contextTotalHours");
  const contextPositionsList = document.getElementById("contextPositionsList");

  function getPositionPrice(id) {
    const pos = positions.find((p) => p.id == id);
    return pos ? pos.price : 0;
  }

  function getPositionName(id) {
    const pos = positions.find((p) => p.id == id);
    return pos ? pos.name : `Позиция ${id}`;
  }

  function updateContextPanel(date) {
    if (!contextPanel) return;
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      clearContextPanel(true);
      contextPanel.classList.add("active");
      return;
    }

    const day = date.getDate();
    const month = date.getMonth();
    if (contextDateShort) contextDateShort.textContent = `${day} ${MONTH_NAMES_GENITIVE[month]}`;

    const dateKey = formatDateKey(date.getFullYear(), month, day);
    const saved = localStorage.getItem(dateKey);

    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (contextTotalEarned) {
          const total =
            data.positions?.reduce(
              (sum, pos) => sum + (getPositionPrice(pos.positionId) || 0) * (pos.quantity || 0),
              0,
            ) || 0;
          contextTotalEarned.textContent = `${formatAmount(total)} ₽`;
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
    <span class="day-context-position-earned">${formatAmount(earned)} ₽</span>
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
        if (contextDateShort) contextDateShort.textContent = "День не выбран";
      } else {
        contextPositionsList.innerHTML = '<div class="day-context-panel__empty">Нет данных за этот день</div>';
      }
    }
  }

  // ==========================================================================
  // 14.5 ОБНОВЛЕНИЕ СТАТИСТИКИ НА ГЛАВНОЙ
  // ==========================================================================
  function updateMainStats() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    let totalEarned = 0;
    let totalMinutes = 0;

    // Загружаем процент премии из настроек
    let bonusPercent = 0;
    const savedSettings = localStorage.getItem("settings");
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        bonusPercent = parseFloat(settings.bonusPercent) || 0; // parseFloat для дробных процентов
      } catch (e) {}
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(year, month, day);
      const saved = localStorage.getItem(dateKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.positions) {
            data.positions.forEach((pos) => {
              totalEarned += (getPositionPrice(pos.positionId) || 0) * (pos.quantity || 0);
            });
          }
          if (data.startTime && data.endTime) {
            const worked = calculateWorkedTime(data.startTime, data.endTime);
            totalMinutes += worked.hours * 60 + worked.minutes;
          }
        } catch (e) {}
      }
    }

    // Сохраняем исходную сумму для расчёта премии
    const baseEarned = totalEarned;

    // Добавляем премию к общей сумме
    if (bonusPercent > 0) {
      totalEarned = baseEarned + Math.round(baseEarned * (bonusPercent / 100));
    }

    // Обновляем DOM — используем formatAmount для скрытия копеек
    const earnedSpan = document.querySelector(".stat-card--earned .stat-card__number");
    const hoursSpan = document.querySelector(".stat-card--hours .stat-card__number");

    if (earnedSpan) earnedSpan.textContent = formatAmount(totalEarned);
    if (hoursSpan) hoursSpan.textContent = Math.floor(totalMinutes / 60);
  }

  // ==========================================================================
  // 15. МОДАЛКА ВРЕМЕНИ
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
    timePickerModal.classList.add("closing");
    setTimeout(() => {
      timePickerModal.classList.remove("active", "closing");
      document.body.style.overflow = "";
      activeTimeInput = null;
    }, 200);
  }

  function fillHourWheel() {
    let html = "";
    for (let hour = 0; hour < 24; hour++) {
      let displayHour = hour.toString().padStart(2, "0");
      html += `<div class="time-picker-wheel-item" data-value="${hour}">${displayHour}</div>`;
    }
    hourWheelItems.innerHTML = html;

    hourWheelItems.removeEventListener("wheel", timePickerHourHandler);
    hourWheelItems.addEventListener("wheel", (timePickerHourHandler = (e) => handleTimeWheelScroll(e, "hour")), {
      passive: false,
    });

    Array.from(hourWheelItems.children).forEach((item) => {
      item.addEventListener("click", () => {
        const value = parseInt(item.dataset.value, 10);
        setTimeWheelPosition("hour", value);
      });
    });
  }

  function fillMinuteWheel() {
    let html = "";
    for (let minute = 0; minute < 60; minute++) {
      let displayMinute = minute.toString().padStart(2, "0");
      html += `<div class="time-picker-wheel-item" data-value="${minute}">${displayMinute}</div>`;
    }
    minuteWheelItems.innerHTML = html;

    minuteWheelItems.removeEventListener("wheel", timePickerMinuteHandler);
    minuteWheelItems.addEventListener("wheel", (timePickerMinuteHandler = (e) => handleTimeWheelScroll(e, "minute")), {
      passive: false,
    });

    Array.from(minuteWheelItems.children).forEach((item) => {
      item.addEventListener("click", () => {
        const value = parseInt(item.dataset.value, 10);
        setTimeWheelPosition("minute", value);
      });
    });
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

    if (newIndex !== currentIndex) setTimeWheelPosition(wheel, newIndex);
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
      updateStats();
      updateShiftTypeIcon();
    }
    closeTimePicker();
  }

  // ==========================================================================
  // 15. ОБРАБОТЧИКИ ДЛЯ МОДАЛКИ ВРЕМЕНИ
  // ==========================================================================
  if (shiftStart && shiftEnd) {
    shiftStart.setAttribute("readonly", true);
    shiftEnd.setAttribute("readonly", true);
    shiftStart.setAttribute("inputmode", "none");
    shiftEnd.setAttribute("inputmode", "none");

    shiftStart.addEventListener("click", (e) => {
      e.preventDefault();
      openTimePicker(shiftStart);
    });
    shiftEnd.addEventListener("click", (e) => {
      e.preventDefault();
      openTimePicker(shiftEnd);
    });
    shiftStart.addEventListener("focus", (e) => e.target.blur());
    shiftEnd.addEventListener("focus", (e) => e.target.blur());
  }

  const timePickerCloseBtn = document.getElementById("timePickerClose");
  const timePickerConfirmBtn = document.getElementById("timePickerConfirm");
  const timePickerOverlayElem = document.querySelector(".time-picker-overlay");

  if (timePickerCloseBtn) timePickerCloseBtn.addEventListener("click", closeTimePicker);
  if (timePickerConfirmBtn) timePickerConfirmBtn.addEventListener("click", confirmTimeSelection);
  if (timePickerOverlayElem) timePickerOverlayElem.addEventListener("click", closeTimePicker);

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
      if (weekPickerModal?.classList.contains("active")) closeWeekPicker();
      if (positionModal?.classList.contains("active")) closePositionModal();
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

    const homeButton = document.querySelector('[data-page="home"]');
    if (homeButton) homeButton.classList.add("active");

    const grid = calendarGrid;
    grid.removeEventListener("click", handleCalendarClick);
    monthHeader.removeEventListener("click", openModal);

    monthHeader.addEventListener("click", () => {
      if (currentPage === "summary") openSummaryMonthPicker();
      else if (currentPage === "reference" || currentPage === "settings") return;
      else openModal();
    });
    grid.addEventListener("click", handleCalendarClick);
    updateContextPanel(null);

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

    const dayModalDeleteBtn = document.getElementById("dayModalDelete");
    if (dayModalDeleteBtn) {
      dayModalDeleteBtn.removeEventListener("click", deleteDayData);
      dayModalDeleteBtn.addEventListener("click", deleteDayData);
    }

    grid.removeEventListener("keydown", handleKeyDown);
    grid.addEventListener("keydown", handleKeyDown);
    document.removeEventListener("keydown", handleEscapeKey);
    document.addEventListener("keydown", handleEscapeKey);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ==========================================================================
  // 18. ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
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
  window.openDayModal = openDayModal;

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

  let summaryCurrentDate = new Date();
  let summaryPeriod = "month";
  let chartInstance = null;

  function getSummaryDateRange() {
    const year = summaryCurrentDate.getFullYear();
    const month = summaryCurrentDate.getMonth();
    const day = summaryCurrentDate.getDate();
    let start, end;

    switch (summaryPeriod) {
      case "week": {
        const dayOfWeek = summaryCurrentDate.getDay();
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

  function updatePeriodTabs() {
    const now = new Date();
    const isCurrentMonth =
      summaryCurrentDate.getFullYear() === now.getFullYear() && summaryCurrentDate.getMonth() === now.getMonth();
    periodTabs.forEach((tab) => {
      const period = tab.dataset.period;
      tab.disabled = period === "week" && !isCurrentMonth ? true : false;
      tab.classList.remove("summary-tab--active");
      if (period === summaryPeriod) tab.classList.add("summary-tab--active");
      if (period === "week" && !isCurrentMonth) tab.classList.add("summary-tab--disabled");
      else tab.classList.remove("summary-tab--disabled");
    });
  }

  function handleTabClick(e) {
    const tab = e.currentTarget;
    if (tab.disabled) return;

    const period = tab.dataset.period;

    // Если кликнули на активную неделю — всё равно открываем выбор
    if (period === "week") {
      openWeekPicker();
    } else {
      summaryPeriod = period;
      updateSummaryPage();
    }
  }

  function initSummaryTabs() {
    periodTabs.forEach((tab) => {
      tab.removeEventListener("click", handleTabClick);
      tab.addEventListener("click", handleTabClick);
    });

    // Ищем кнопку при каждом вызове (на случай, если страница ещё не загружена)
    const downloadBtn = document.getElementById("downloadPdfBtn");
    if (downloadBtn) {
      // Удаляем старый обработчик, чтобы не было дублей
      downloadBtn.removeEventListener("click", generatePDFReport);
      downloadBtn.addEventListener("click", generatePDFReport);
      console.log("Обработчик PDF отчёта добавлен");
    } else {
      console.warn("Кнопка downloadPdfBtn не найдена в DOM");
    }
  }

  function updateSummaryData() {
    const { start, end } = getSummaryDateRange();
    let totalEarned = 0;
    let totalMinutes = 0;
    const positionsMap = new Map();

    let bonusPercent = 0;
    const savedSettings = localStorage.getItem("settings");
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        bonusPercent = settings.bonusPercent || 0;
      } catch (e) {}
    }

    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      const saved = localStorage.getItem(dateKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.positions) {
            data.positions.forEach((pos) => {
              const id = pos.positionId;
              const quantity = pos.quantity || 0;
              const price = getPositionPrice(id) || 0;
              const earned = price * quantity;
              totalEarned += earned;
              if (positionsMap.has(id)) {
                const existing = positionsMap.get(id);
                existing.quantity += quantity;
                existing.earned += earned;
              } else {
                positionsMap.set(id, { id, quantity, earned, name: getPositionName(id) });
              }
            });
          }
          if (data.startTime && data.endTime) {
            const worked = calculateWorkedTime(data.startTime, data.endTime);
            totalMinutes += worked.hours * 60 + worked.minutes;
          }
        } catch (e) {}
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (summaryTotalEarned) summaryTotalEarned.textContent = formatAmount(totalEarned);
    if (summaryTotalBonus) {
      if (bonusPercent > 0) {
        const bonus = Math.round(totalEarned * (bonusPercent / 100));
        summaryTotalBonus.textContent = formatAmount(bonus);
      } else summaryTotalBonus.textContent = "0";
    }
    if (summaryTotalHours) summaryTotalHours.textContent = Math.floor(totalMinutes / 60).toString();

    renderSummaryPositions(positionsMap);
  }

  function renderSummaryPositions(positionsMap) {
    if (!summaryPositionsList) return;
    summaryPositionsList.style.opacity = "0";
    setTimeout(() => {
      summaryPositionsList.style.transition = "opacity 0.2s ease";
      summaryPositionsList.style.opacity = "1";
    }, 10);

    const positions = Array.from(positionsMap.values()).sort((a, b) => b.earned - a.earned);
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
            <span class="summary-position-earned">${formatAmount(pos.earned)} ₽</span>
          </div>
        </div>
      `;
    });
    summaryPositionsList.innerHTML = html;
  }

  function updateSummaryPage() {
    if (!summaryPage || summaryPage.style.display !== "flex") return;
    updatePeriodText();
    updatePeriodTabs();
    updateSummaryData();
    updateSummaryChart();
  }

  function setSummaryMonth(year, month) {
    summaryCurrentDate = new Date(year, month, 1);
    const now = new Date();
    if (summaryPeriod === "week" && (year !== now.getFullYear() || month !== now.getMonth())) {
      summaryPeriod = "month";
    }
    updateSummaryPage();
  }

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

  function updateSummaryChart() {
    const canvas = document.getElementById("summaryChart");
    if (!canvas) return;

    const currentYear = summaryCurrentDate.getFullYear();
    const currentMonth = summaryCurrentDate.getMonth();
    let prevYear = currentYear;
    let prevMonth = currentMonth;
    let prevLabel = "";

    switch (summaryPeriod) {
      case "week": {
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
        prevMonth = currentMonth - 1;
        if (prevMonth < 0) {
          prevMonth = 11;
          prevYear = currentYear - 1;
        }
        prevLabel = `${MONTH_NAMES_GENITIVE[prevMonth]} ${prevYear}`;
        break;
      case "year":
        prevYear = currentYear - 1;
        prevLabel = prevYear.toString();
        break;
    }

    function getPeriodData(year, month, period) {
      let total = 0;
      switch (period) {
        case "week": {
          const startDate = new Date(summaryCurrentDate);
          if (year !== currentYear || month !== currentMonth) startDate.setDate(startDate.getDate() - 7);
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
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          for (let day = 1; day <= daysInMonth; day++) {
            const key = formatDateKey(year, month, day);
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
        case "year": {
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
                      total += (getPositionPrice(p.positionId) || 0) * (p.quantity || 0);
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

    const currentTotal = getPeriodData(currentYear, currentMonth, summaryPeriod);
    const prevTotal = getPeriodData(prevYear, prevMonth, summaryPeriod);

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

    const hasData = currentTotal > 0 || prevTotal > 0;
    if (!hasData) {
      showChartPlaceholder();
      return;
    }
    showChart(canvas, currentTotal, prevTotal, currentLabel, prevLabel);
  }

  function showChartPlaceholder() {
    const canvas = document.getElementById("summaryChart");
    if (!canvas) return;
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    canvas.style.display = "none";
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

  function showChart(canvas, currentTotal, prevTotal, currentLabel, prevLabel) {
    canvas.style.display = "block";
    const placeholder = document.querySelector(".summary-chart-placeholder");
    if (placeholder) placeholder.style.display = "none";
    if (chartInstance) chartInstance.destroy();

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
        layout: { padding: { left: 0, right: 16, top: 4, bottom: 8 } },
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "start",
            labels: {
              color: "#E9E9E9",
              font: { family: "Google Sans", size: 12, weight: "500" },
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
            titleFont: { family: "Google Sans", size: 12, weight: "500" },
            bodyColor: "#A0A0A0",
            bodyFont: { family: "Google Sans", size: 11 },
            borderColor: "#6D9F71",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => `${Math.round(ctx.raw).toLocaleString("ru-RU")} ₽`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(233,233,233,0.1)", drawBorder: false },
            border: { display: false },
            min: 0,
            max: maxValue * 1.15,
            ticks: {
              color: "#A0A0A0",
              font: { family: "Google Sans", size: 11 },
              padding: 6,
              callback: (val) => {
                if (val >= 1e6) return Math.round(val / 1e6) + "M";
                if (val >= 1e3) return Math.round(val / 1e3) + "K";
                return Math.round(val);
              },
              stepSize: maxValue / 4,
            },
          },
          y: { grid: { display: false }, border: { display: false }, ticks: { display: false } },
        },
        barThickness: 24,
        maxBarThickness: 28,
        grouped: true,
      },
    });
  }

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

  function getWeeksInMonth(year, month) {
    const weeks = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDate = new Date(firstDay);
    const dayOfWeek = startDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(firstDay.getDate() - mondayOffset);
    let weekNumber = 1;
    let currentDate = new Date(startDate);
    while (currentDate <= lastDay || currentDate.getMonth() === month) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(currentDate.getDate() + 6);
      if (weekEnd >= firstDay || weekStart <= lastDay) {
        weeks.push({ number: weekNumber, start: new Date(weekStart), end: new Date(weekEnd) });
        weekNumber++;
      }
      currentDate.setDate(currentDate.getDate() + 7);
      if (weekNumber > 6) break;
    }
    return weeks;
  }

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
    document.querySelectorAll(".week-picker-item").forEach((item) => {
      item.addEventListener("click", () => {
        document.querySelectorAll(".week-picker-item").forEach((el) => el.classList.remove("selected"));
        item.classList.add("selected");
        selectedWeekIndex = parseInt(item.dataset.weekIndex);
      });
    });
  }

  function openWeekPicker() {
    if (!weekPickerModal) return;
    fillWeekList();
    weekPickerModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeWeekPicker() {
    if (!weekPickerModal) return;
    weekPickerModal.classList.remove("active");
    document.body.style.overflow = "";
  }

  function confirmWeekSelection() {
    if (weeksInMonth[selectedWeekIndex]) {
      const week = weeksInMonth[selectedWeekIndex];
      summaryCurrentDate = new Date(week.start);
      summaryPeriod = "week";
      updateSummaryPage();
    }
    closeWeekPicker();
  }

  if (weekPickerClose) weekPickerClose.addEventListener("click", closeWeekPicker);
  if (weekPickerConfirm) weekPickerConfirm.addEventListener("click", confirmWeekSelection);
  if (weekPickerOverlay) weekPickerOverlay.addEventListener("click", closeWeekPicker);

  // ==========================================================================
  // 20. СТРАНИЦА СПРАВОЧНИКА
  // ==========================================================================
  const referencePage = document.getElementById("referencePage");
  const referenceList = document.getElementById("referenceList");
  const addReferenceBtn = document.getElementById("addReferenceBtn");

  const positionModal = document.getElementById("positionModal");
  const positionModalTitle = document.getElementById("positionModalTitle");
  const positionModalClose = document.getElementById("positionModalClose");
  const positionModalCancel = document.getElementById("positionModalCancel");
  const positionModalDelete = document.getElementById("positionModalDelete");
  const positionModalSave = document.getElementById("positionModalSave");
  const positionNameInput = document.getElementById("positionNameInput");
  const positionPriceInput = document.getElementById("positionPriceInput");
  const positionModalOverlay = document.querySelector(".position-modal-overlay");

  let editingPositionId = null;
  let referenceClickTimer = null;
  const REFERENCE_DOUBLE_CLICK_DELAY = 250;
  let positions = [];

  function loadPositions() {
    const saved = localStorage.getItem("positions");
    if (saved) {
      try {
        positions = JSON.parse(saved);
      } catch (e) {
        console.error("Ошибка загрузки позиций", e);
        positions = [];
      }
    } else {
      positions = [
        { id: 1, name: "Гайка ГЕ8.935.200-02", price: 2.8391 },
        { id: 2, name: "Гайка ГЕ8.935.200-03", price: 2.8391 },
        { id: 3, name: "Гайка ГЕ8.935.200-04", price: 2.8391 },
        { id: 4, name: "Гайка ГЕ8.935.200-05", price: 2.8391 },
        { id: 5, name: "Гайка ГЕ8.935.200-06", price: 3.575 },
        { id: 6, name: "Гайка ГЕ8.935.200-07", price: 3.575 },
        { id: 7, name: "Гайка ГЕ8.935.200-08", price: 3.575 },
        { id: 8, name: "Гайка ГЕ8.935.200-09", price: 3.575 },
        { id: 9, name: "Гайка ГЕ8.935.200-10", price: 3.575 },
        { id: 10, name: "кожух ГЕ8.634.487-02", price: 4.079865 },
        { id: 11, name: "кожух ГЕ8.634.487-03", price: 4.079865 },
        { id: 12, name: "кожух ГЕ8.634.487-04", price: 4.079865 },
        { id: 13, name: "кожух ГЕ8.634.487-05", price: 4.079865 },
        { id: 14, name: "кожух ГЕ8.634.487-06", price: 4.079865 },
        { id: 15, name: "кожух ГЕ8.634.487-07", price: 4.079865 },
        { id: 16, name: "кожух ГЕ8.634.487-08", price: 4.079865 },
        { id: 17, name: "кожух ГЕ8.634.487-09", price: 4.079865 },
        { id: 18, name: "гайка 043", price: 2.55 },
        { id: 19, name: "кожух ГЕ8.634.419", price: 12 },
        { id: 20, name: "кожух ГЕ8.634.419-01", price: 12 },
        { id: 21, name: "кожух ГЕ8.634.419-07", price: 12 },
        { id: 22, name: "кожух ГЕ8.634.419-02", price: 12 },
        { id: 23, name: "кожух ГЕ8.634.419-03", price: 12 },
        { id: 24, name: "кожух ГЕ8.634.419-04", price: 12 },
        { id: 25, name: "кожух ГЕ8.634.419-05", price: 12 },
      ];
      savePositions();
    }
  }

  function savePositions() {
    localStorage.setItem("positions", JSON.stringify(positions));
  }

  function normalizePrice(input) {
    const normalized = input.replace(/,/g, ".").replace(/\s/g, "");
    const price = parseFloat(normalized);
    if (isNaN(price) || price < 0) return null;
    return Math.round(price * 100) / 100;
  }

  function formatPrice(price) {
    return price.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function handleReferenceItemClick(e) {
    const item = e.currentTarget;
    const id = parseInt(item.dataset.id);
    if (referenceClickTimer) {
      clearTimeout(referenceClickTimer);
      referenceClickTimer = null;
      openEditPositionModal(id);
      return;
    }
    referenceClickTimer = setTimeout(() => {
      referenceClickTimer = null;
    }, REFERENCE_DOUBLE_CLICK_DELAY);
  }

  function renderReferenceList() {
    if (!referenceList) return;
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
    attachClickHandlers();
  }

  function attachClickHandlers() {
    const items = document.querySelectorAll(".reference-item");
    items.forEach((item) => {
      item.removeEventListener("click", handleReferenceItemClick);
      item.addEventListener("click", handleReferenceItemClick);
    });
  }

  function openAddPositionModal() {
    editingPositionId = null;
    positionModalTitle.textContent = "Новая позиция";
    positionNameInput.value = "";
    positionPriceInput.value = "";
    positionModalDelete.style.display = "none";
    positionModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function openEditPositionModal(id) {
    const position = positions.find((p) => p.id === id);
    if (!position) return;
    editingPositionId = id;
    positionModalTitle.textContent = "Редактировать";
    positionNameInput.value = position.name;
    positionPriceInput.value = position.price;
    positionModalDelete.style.display = "block";
    positionModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closePositionModal() {
    positionModal.classList.remove("active");
    document.body.style.overflow = "";
    editingPositionId = null;
  }

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

    if (dayModal.classList.contains("active")) renderDayModalPositions();
    savePositions();
    renderReferenceList();
    closePositionModal();

    // ✅ ОТПРАВЛЯЕМ В ОБЛАКО
    if (navigator.onLine) {
      syncAllData();
    } else {
      // Если нет интернета, данные уже в pendingQueue
      console.log("Позиции сохранены локально, отправятся при появлении сети");
    }
  }

  function deletePosition() {
    if (!editingPositionId) return;
    positions = positions.filter((p) => p.id !== editingPositionId);
    if (dayModal.classList.contains("active")) renderDayModalPositions();
    savePositions();
    renderReferenceList();
    closePositionModal();
  }

  if (addReferenceBtn) addReferenceBtn.addEventListener("click", openAddPositionModal);
  if (positionModalClose) positionModalClose.addEventListener("click", closePositionModal);
  if (positionModalCancel) positionModalCancel.addEventListener("click", closePositionModal);
  if (positionModalDelete) positionModalDelete.addEventListener("click", deletePosition);
  if (positionModalSave) positionModalSave.addEventListener("click", savePosition);
  if (positionModalOverlay) positionModalOverlay.addEventListener("click", closePositionModal);

  loadPositions();
  renderReferenceList();

  // ==========================================================================
  // 21. СТРАНИЦА НАСТРОЕК
  // ==========================================================================
  const settingsPage = document.getElementById("settingsPage");
  const bonusPercentValue = document.querySelector('[data-key="bonusPercent"]');
  const teamSizeValue = document.querySelector('[data-key="teamSize"]');
  const feedbackInput = document.querySelector(".settings-feedback-input");
  const feedbackSendBtn = document.getElementById("feedbackSendBtn");

  let settings = { bonusPercent: 15, teamSize: 2 };

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
    const versionElement = document.querySelector(".settings-item-version");
    if (versionElement) versionElement.textContent = APP_VERSION;
  }

  function animateSave(element) {
    if (!element) return;
    element.classList.add("saved");
    setTimeout(() => element.classList.remove("saved"), 600);
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

  function startValueEditing(element, key, type = "int") {
    if (element.querySelector("input")) return;
    const textSpan = element.querySelector(".settings-item-value-text");
    const currentValue = settings[key];
    textSpan.style.display = "none";

    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    if (key === "bonusPercent") {
      input.min = "0";
      input.max = "100";
      input.step = "1";
    } else if (key === "teamSize") {
      input.min = "1";
      input.max = "20";
      input.step = "1";
    } else {
      input.min = type === "float" ? "0" : "1";
      input.step = type === "float" ? "0.01" : "1";
    }
    input.value = currentValue;
    input.className = "settings-item-value-input";

    element.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener("blur", () => finishValueEditing(element, key, input.value, type, textSpan));
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
      if (val > 100) val = 100;
    } else if (key === "teamSize") {
      val = parseInt(newValue, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 20) val = 20;
    } else {
      val = type === "float" ? parseFloat(newValue) : parseInt(newValue, 10);
      if (isNaN(val) || val < (type === "float" ? 0 : 1)) val = settings[key];
    }

    settings[key] = val;
    saveSettings();
    const input = element.querySelector("input");
    if (input) input.remove();
    textSpan.textContent = val;
    textSpan.style.display = "block";
    animateSave(element);
    vibrate(20);

    // ✅ ОТПРАВЛЯЕМ НАСТРОЙКИ В ОБЛАКО
    if (navigator.onLine) {
      syncAllData();
    }
  }

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

  function sendFeedback() {
    const message = feedbackInput.value.trim();
    if (!message) return;
    const FORM_ID = "1FAIpQLSfZRjWdS8r7E4ihzPpyfkKkdvCrSJyFKsYaphbWR_5Gbj_LEA";
    const FIELD_ID = "entry.1722024578";
    fetch(`https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`, {
      method: "POST",
      mode: "no-cors",
      body: new URLSearchParams({ [FIELD_ID]: message }),
    }).catch((error) => console.log("Отправка выполнена (ответ не ожидается):", error));
    feedbackInput.value = "";
    localStorage.removeItem("feedback");
    updateFeedbackButtonState();
    const originalHtml = feedbackSendBtn.innerHTML;
    feedbackSendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M16.6667 5L7.5 14.1667L3.33333 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    setTimeout(() => {
      feedbackSendBtn.innerHTML = originalHtml;
    }, 2000);
  }

  if (bonusPercentValue)
    bonusPercentValue.addEventListener("click", () => startValueEditing(bonusPercentValue, "bonusPercent", "int"));
  if (teamSizeValue) teamSizeValue.addEventListener("click", () => startValueEditing(teamSizeValue, "teamSize", "int"));

  if (feedbackInput) {
    feedbackInput.addEventListener("input", updateFeedbackButtonState);
    let feedbackTimer;
    feedbackInput.addEventListener("input", () => {
      clearTimeout(feedbackTimer);
      feedbackTimer = setTimeout(() => localStorage.setItem("feedback", feedbackInput.value), 500);
    });
    const savedFeedback = localStorage.getItem("feedback");
    if (savedFeedback) feedbackInput.value = savedFeedback;
    feedbackInput.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (feedbackInput.value.trim().length > 0) sendFeedback();
      }
    });
  }

  if (feedbackSendBtn) {
    feedbackSendBtn.addEventListener("click", sendFeedback);
    updateFeedbackButtonState();
  }

  loadSettings();

  // ==========================================================================
  // 22. НАВИГАЦИОННАЯ ПАНЕЛЬ
  // ==========================================================================
  const navButtons = document.querySelectorAll(".app-nav__button");
  let currentPage = "home";

  function switchPage(page) {
    navButtons.forEach((btn) => btn.classList.remove("active"));
    const activeButton = document.querySelector(`[data-page="${page}"]`);
    if (activeButton) activeButton.classList.add("active");

    const calendarSection = document.querySelector(".calendar-section");
    const statsSection = document.querySelector(".stats-section");
    const contextPanel = document.getElementById("dayContextPanel");

    if (calendarSection) calendarSection.style.display = "none";
    if (statsSection) statsSection.style.display = "none";
    if (contextPanel) contextPanel.style.display = "none";
    if (summaryPage) summaryPage.style.display = "none";
    if (referencePage) referencePage.style.display = "none";
    if (settingsPage) settingsPage.style.display = "none";

    const appMain = document.querySelector(".app-main");
    if (appMain) appMain.classList.remove("app-main--home", "app-main--summary");
    const monthElement = document.querySelector(".app-header__month");

    switch (page) {
      case "home":
        if (calendarSection) calendarSection.style.display = "block";
        if (statsSection) statsSection.style.display = "block";
        if (contextPanel) contextPanel.style.display = "flex";
        if (appMain) appMain.classList.add("app-main--home");
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
          initSummaryTabs(); // <-- ПЕРЕИНИЦИАЛИЗИРУЕМ ПРИ КАЖДОМ ПЕРЕКЛЮЧЕНИИ
          if (appMain) appMain.classList.add("app-main--summary");
          if (monthElement) {
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
          if (monthElement) monthElement.textContent = "Справочник";
        }
        break;
      case "settings":
        if (settingsPage) {
          settingsPage.style.display = "flex";
          if (appMain) appMain.classList.add("app-main--settings");
          if (monthElement) monthElement.textContent = "Настройки";
        }
        break;
    }
    currentPage = page;
  }

  if (navButtons.length) {
    const pages = ["home", "summary", "reference", "settings"];
    navButtons.forEach((btn, index) => {
      btn.setAttribute("data-page", pages[index]);
      btn.addEventListener("click", () => switchPage(pages[index]));
    });
  }

  navButtons.forEach((btn) => (btn.style.transition = "all 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.1)"));

  function confirmSelection() {
    if (isSummaryMonthPicker) {
      setSummaryMonth(state.tempYear, state.tempMonth);
      isSummaryMonthPicker = false;
    } else {
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

  // ==========================================================================
  // 23. ГЕНЕРАЦИЯ PDF ОТЧЁТА (ДЕТАЛИЗИРОВАННЫЙ, ОФИЦИАЛЬНЫЙ)
  // ==========================================================================

  function generatePDFReport() {
    console.log("Генерация PDF отчёта...");
    const period = summaryPeriod;
    const startEnd = getSummaryDateRange();
    const start = startEnd.start;
    const end = startEnd.end;

    // Форматируем период
    let periodTitle = "";
    if (period === "week") {
      periodTitle = `${start.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} – ${end.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}`;
    } else if (period === "month") {
      periodTitle = start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    } else {
      periodTitle = start.getFullYear().toString();
    }

    // Дата формирования отчёта
    const reportDate = new Date().toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // --- СБОР ДАННЫХ ПО ДНЯМ ---
    const daysData = [];
    const positionsMap = new Map(); // для сводной таблицы позиций

    let totalEarned = 0;
    let totalMinutes = 0;

    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      const saved = localStorage.getItem(dateKey);

      const dayInfo = {
        date: new Date(currentDate),
        dateStr: currentDate.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
        weekday: currentDate.toLocaleDateString("ru-RU", { weekday: "short" }),
        startTime: "",
        endTime: "",
        hoursWorked: 0,
        minutesWorked: 0,
        earned: 0,
        positions: [],
      };

      if (saved) {
        try {
          const data = JSON.parse(saved);

          // Проверяем, есть ли позиции с количеством > 0
          const hasPositions =
            data.positions && data.positions.length > 0 && data.positions.some((p) => p.quantity > 0);

          // Если позиций нет — пропускаем день (не считаем заполненным)
          if (!hasPositions) {
            dayInfo.startTime = "—";
            dayInfo.endTime = "—";
            daysData.push(dayInfo);
            currentDate.setDate(currentDate.getDate() + 1);
            continue; // <--- ИСПРАВЛЕНО: continue вместо return
          }

          dayInfo.startTime = data.startTime || "—";
          dayInfo.endTime = data.endTime || "—";

          if (data.startTime && data.endTime) {
            const worked = calculateWorkedTime(data.startTime, data.endTime);
            dayInfo.hoursWorked = worked.hours;
            dayInfo.minutesWorked = worked.minutes;
            totalMinutes += worked.hours * 60 + worked.minutes;
          }

          if (data.positions && data.positions.length > 0) {
            data.positions.forEach((pos) => {
              if (pos.quantity > 0) {
                // учитываем только позиции с количеством
                const id = pos.positionId;
                const qty = pos.quantity || 0;
                const price = getPositionPrice(id) || 0;
                const earned = price * qty;

                dayInfo.earned += earned;
                dayInfo.positions.push({
                  name: getPositionName(id),
                  quantity: qty,
                  earned: earned,
                });

                // Для сводной таблицы позиций
                if (positionsMap.has(id)) {
                  const existing = positionsMap.get(id);
                  existing.quantity += qty;
                  existing.earned += earned;
                } else {
                  positionsMap.set(id, {
                    name: getPositionName(id),
                    quantity: qty,
                    earned: earned,
                  });
                }
              }
            });
          }
          totalEarned += dayInfo.earned;
        } catch (e) {}
      } else {
        dayInfo.startTime = "—";
        dayInfo.endTime = "—";
      }

      daysData.push(dayInfo);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // --- РАСЧЁТ ДОПОЛНИТЕЛЬНЫХ ПОКАЗАТЕЛЕЙ ---
    let bonusPercent = 0;
    let teamSize = 1;
    const savedSettings = localStorage.getItem("settings");
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        bonusPercent = settings.bonusPercent || 0;
        teamSize = settings.teamSize || 1;
      } catch (e) {}
    }

    const bonusAmount = Math.round(totalEarned * (bonusPercent / 100));
    const totalWithBonus = totalEarned + bonusAmount;
    const perPerson = Math.round(totalWithBonus / teamSize);

    const totalHours = Math.floor(totalMinutes / 60);
    const totalMinutesRemain = totalMinutes % 60;
    const totalHoursStr = totalMinutesRemain > 0 ? `${totalHours} ч ${totalMinutesRemain} мин` : `${totalHours} ч`;

    // --- ДОПОЛНИТЕЛЬНЫЕ ПОКАЗАТЕЛИ (ПУНКТ 1) ---
    const daysWithData = daysData.filter((day) => day.earned > 0).length;
    const avgPerDay = daysWithData > 0 ? Math.round(totalEarned / daysWithData) : 0;

    // --- ДАННЫЕ ЗА ПРОШЛЫЙ ПЕРИОД ДЛЯ СРАВНЕНИЯ (ПУНКТ 5) ---
    let prevPeriodTotal = 0;
    let prevPeriodDays = 0;

    let prevStart, prevEnd;
    if (period === "week") {
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 7);
    } else if (period === "month") {
      prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      prevEnd = new Date(start.getFullYear(), start.getMonth(), 0);
    } else {
      // year
      prevStart = new Date(start.getFullYear() - 1, 0, 1);
      prevEnd = new Date(start.getFullYear() - 1, 11, 31);
    }

    let prevCurrentDate = new Date(prevStart);
    while (prevCurrentDate <= prevEnd) {
      const dateKey = formatDateKey(
        prevCurrentDate.getFullYear(),
        prevCurrentDate.getMonth(),
        prevCurrentDate.getDate(),
      );
      const saved = localStorage.getItem(dateKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.positions) {
            data.positions.forEach((pos) => {
              const price = getPositionPrice(pos.positionId) || 0;
              prevPeriodTotal += price * (pos.quantity || 0);
            });
          }
          if (data.positions && data.positions.length > 0) prevPeriodDays++;
        } catch (e) {}
      }
      prevCurrentDate.setDate(prevCurrentDate.getDate() + 1);
    }

    let dynamicPercent = 0;
    let dynamicText = "—";
    if (prevPeriodTotal > 0) {
      dynamicPercent = Math.round(((totalEarned - prevPeriodTotal) / prevPeriodTotal) * 100);

      // Ограничиваем отображение, чтобы не было космических цифр
      if (dynamicPercent > 500) {
        dynamicText = "> 500%";
      } else if (dynamicPercent < -500) {
        dynamicText = "< -500%";
      } else {
        dynamicText = dynamicPercent > 0 ? `+${dynamicPercent}%` : `${dynamicPercent}%`;
      }
    } else if (totalEarned > 0) {
      dynamicText = "новый период"; // было 0, стало > 0
    } else {
      dynamicText = "—";
    }

    // --- ПОСТРОЕНИЕ ТАБЛИЦЫ ДНЕЙ ---
    const daysTableBody = [
      [
        { text: "Дата", style: "tableHeader" },
        { text: "Начало", style: "tableHeaderCenter" },
        { text: "Конец", style: "tableHeaderCenter" },
        { text: "Часы", style: "tableHeaderCenter" },
        { text: "Сумма (₽)", style: "tableHeaderRight" },
      ],
    ];

    daysData.forEach((day) => {
      if (day.earned > 0 || day.startTime !== "—") {
        daysTableBody.push([
          { text: `${day.dateStr}, ${day.weekday}`, style: "tableCell" },
          { text: day.startTime, style: "tableCellCenter" },
          { text: day.endTime, style: "tableCellCenter" },
          {
            text: day.hoursWorked > 0 ? `${day.hoursWorked}:${day.minutesWorked.toString().padStart(2, "0")}` : "—",
            style: "tableCellCenter",
          },
          { text: day.earned > 0 ? Math.round(day.earned).toLocaleString("ru-RU") : "—", style: "tableCellRight" },
        ]);
      }
    });

    // Если нет дней с данными, добавляем заглушку
    if (daysTableBody.length === 1) {
      daysTableBody.push([
        { text: "Нет данных за выбранный период", colSpan: 5, alignment: "center", style: "emptyCell" },
        {},
        {},
        {},
        {},
      ]);
    }

    // --- ПОСТРОЕНИЕ СВОДНОЙ ТАБЛИЦЫ ПОЗИЦИЙ ---
    const positionsTableBody = [
      [
        { text: "Наименование позиции", style: "tableHeader" },
        { text: "Количество", style: "tableHeaderCenter" },
        { text: "Сумма (₽)", style: "tableHeaderRight" },
      ],
    ];

    positionsMap.forEach((pos) => {
      positionsTableBody.push([
        { text: pos.name, style: "tableCell" },
        { text: pos.quantity.toString(), style: "tableCellCenter" },
        { text: Math.round(pos.earned).toLocaleString("ru-RU"), style: "tableCellRight" },
      ]);
    });

    if (positionsMap.size === 0) {
      positionsTableBody.push([{ text: "Нет данных", colSpan: 3, alignment: "center", style: "emptyCell" }, {}, {}]);
    }

    // --- СОЗДАНИЕ PDF ДОКУМЕНТА ---
    const docDefinition = {
      pageSize: "A4",
      pageMargins: [40, 90, 40, 70],

      // Верхний колонтитул
      header: {
        columns: [
          {
            width: 120,
            text: "СМЕНКА",
            fontSize: 18,
            bold: true,
            color: "#6d9f71",
            margin: [40, 20, 0, 0],
          },
          {
            width: "*",
            text: "ОТЧЁТ О ВЫПОЛНЕННЫХ РАБОТАХ",
            fontSize: 14,
            color: "#333",
            bold: true,
            alignment: "center",
            margin: [0, 22, 0, 0],
          },
          {
            width: 120,
            text: `от ${new Date().toLocaleDateString("ru-RU")}`,
            fontSize: 10,
            color: "#999",
            alignment: "right",
            margin: [0, 24, 40, 0],
          },
        ],
      },

      // Нижний колонтитул
      footer: function (currentPage, pageCount) {
        return {
          columns: [
            {
              text: `Сформировано: ${reportDate}`,
              alignment: "left",
              margin: [40, 0, 0, 20],
              fontSize: 8,
              color: "#999",
            },
            {
              text: `стр. ${currentPage} из ${pageCount}`,
              alignment: "right",
              margin: [0, 0, 40, 20],
              fontSize: 8,
              color: "#999",
            },
          ],
        };
      },

      content: [
        // --- КАРТОЧКИ ИТОГОВ (таблица 2×2) ---
        {
          style: "summaryTable",
          table: {
            widths: ["*", "*"],
            body: [
              [
                {
                  stack: [
                    { text: "ИТОГО ЗА ПЕРИОД", style: "summaryCardLabel" },
                    { text: `${Math.round(totalEarned).toLocaleString("ru-RU")} ₽`, style: "summaryCardValue" },
                  ],
                  style: "summaryCard",
                },
                {
                  stack: [
                    { text: `ПРЕМИЯ (${bonusPercent}%)`, style: "summaryCardLabel" },
                    { text: `${Math.round(bonusAmount).toLocaleString("ru-RU")} ₽`, style: "summaryCardValue" },
                  ],
                  style: "summaryCard",
                },
              ],
              [
                {
                  stack: [
                    { text: "ИТОГО С ПРЕМИЕЙ", style: "summaryCardLabel" },
                    { text: `${Math.round(totalWithBonus).toLocaleString("ru-RU")} ₽`, style: "summaryCardValueGreen" },
                  ],
                  style: "summaryCard",
                },
                {
                  stack: [
                    { text: `НА 1 ЧЕЛОВЕКА`, style: "summaryCardLabel" },
                    { text: `${Math.round(perPerson).toLocaleString("ru-RU")} ₽`, style: "summaryCardValueGreen" },
                  ],
                  style: "summaryCard",
                },
              ],
            ],
          },
          layout: {
            fillColor: "#ffffff",
            hLineWidth: function () {
              return 1;
            },
            vLineWidth: function () {
              return 1;
            },
            hLineColor: "#e0e0e0",
            vLineColor: "#e0e0e0",
            paddingLeft: function () {
              return 15;
            },
            paddingRight: function () {
              return 15;
            },
            paddingTop: function () {
              return 15;
            },
            paddingBottom: function () {
              return 15;
            },
          },
        },

        // --- ДОПОЛНИТЕЛЬНАЯ СТАТИСТИКА (ПУНКТЫ 1 и 5) ---
        {
          style: "statsRow",
          columns: [
            {
              width: "*",
              stack: [
                { text: "ОТРАБОТАНО СМЕН", style: "statsLabel" },
                { text: daysWithData.toString(), style: "statsNumber" },
              ],
              style: "statsItem",
            },
            {
              width: "*",
              stack: [
                { text: "СР. ДОХОД ЗА СМЕНУ", style: "statsLabel" },
                { text: avgPerDay > 0 ? `${avgPerDay.toLocaleString("ru-RU")} ₽` : "0 ₽", style: "statsNumber" },
              ],
              style: "statsItem",
            },
            {
              width: "*",
              stack: [
                { text: "К ПРОШЛОМУ ПЕРИОДУ", style: "statsLabel" },
                { text: dynamicText, style: dynamicPercent >= 0 ? "statsNumberGreen" : "statsNumberRed" },
              ],
              style: "statsItem",
            },
          ],
        },

        // Разделитель
        {
          canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: "#6d9f71" }],
          margin: [0, 25, 0, 20],
        },

        // --- ДЕТАЛИЗАЦИЯ ПО ДНЯМ ---
        { text: "ПОДЕТАЛЬНЫЙ УЧЁТ СМЕН", style: "sectionTitle" },
        { text: periodTitle, style: "sectionSubtitle" },

        {
          style: "mainTable",
          table: {
            headerRows: 1,
            widths: ["*", 45, 45, 45, 65],
            body: daysTableBody,
          },
          layout: {
            fillColor: function (rowIndex) {
              return rowIndex === 0 ? "#f0f7f0" : rowIndex % 2 === 0 ? "#fafafa" : null;
            },
            hLineWidth: function (i, node) {
              return i === 0 || i === node.table.body.length ? 1 : 0.5;
            },
            vLineWidth: function () {
              return 0.5;
            },
            hLineColor: "#ccc",
            vLineColor: "#ccc",
            paddingLeft: function () {
              return 6;
            },
            paddingRight: function () {
              return 6;
            },
            paddingTop: function () {
              return 8;
            },
            paddingBottom: function () {
              return 8;
            },
          },
        },

        // Итог по дням
        {
          style: "dailyTotal",
          columns: [
            { width: "*", text: "" },
            {
              width: "auto",
              stack: [
                { text: "ВСЕГО ЗА ПЕРИОД", style: "dailyTotalLabel" },
                { text: `${Math.round(totalEarned).toLocaleString("ru-RU")} ₽`, style: "dailyTotalValue" },
              ],
            },
          ],
        },

        // --- СВОДКА ПО ПОЗИЦИЯМ ---
        { text: "СВОДКА ПО ВИДАМ РАБОТ", style: "sectionTitle", margin: [0, 25, 0, 10] },

        {
          style: "mainTable",
          table: {
            headerRows: 1,
            widths: ["*", 55, 70],
            body: positionsTableBody,
          },
          layout: {
            fillColor: function (rowIndex) {
              return rowIndex === 0 ? "#f0f7f0" : rowIndex % 2 === 0 ? "#fafafa" : null;
            },
            hLineWidth: function (i, node) {
              return i === 0 || i === node.table.body.length ? 1 : 0.5;
            },
            vLineWidth: function () {
              return 0.5;
            },
            hLineColor: "#ccc",
            vLineColor: "#ccc",
            paddingLeft: function () {
              return 8;
            },
            paddingRight: function () {
              return 8;
            },
            paddingTop: function () {
              return 8;
            },
            paddingBottom: function () {
              return 8;
            },
          },
        },

        // --- ОБЩИЙ ИТОГ ---
        {
          style: "grandTotal",
          columns: [
            { width: "*", text: "" },
            {
              width: "auto",
              stack: [
                { text: "ИТОГОВАЯ СУММА К ВЫПЛАТЕ", style: "grandTotalLabel" },
                { text: `${Math.round(totalWithBonus).toLocaleString("ru-RU")} ₽`, style: "grandTotalValue" },
              ],
            },
          ],
        },

        // Информационная строка
        {
          text: `Отработано всего: ${totalHoursStr} · Премия начислена в размере ${bonusPercent}% от основной суммы`,
          style: "infoLine",
          margin: [0, 15, 0, 0],
        },
      ],

      styles: {
        sectionTitle: {
          fontSize: 16,
          bold: true,
          color: "#6d9f71",
          margin: [0, 15, 0, 5],
        },
        sectionSubtitle: {
          fontSize: 12,
          color: "#666",
          margin: [0, 0, 0, 15],
        },
        summaryCard: {
          alignment: "center",
        },
        summaryCardLabel: {
          fontSize: 10,
          color: "#999",
          margin: [0, 0, 0, 6],
        },
        summaryCardValue: {
          fontSize: 18,
          bold: true,
          color: "#333",
        },
        summaryCardValueGreen: {
          fontSize: 18,
          bold: true,
          color: "#6d9f71",
        },
        statsRow: {
          margin: [0, 10, 0, 20],
          columnGap: 10,
        },
        statsItem: {
          alignment: "center",
          fillColor: "#f9f9f9",
          border: [true, true, true, true],
          borderColor: "#e0e0e0",
          borderWidth: 1,
          borderRadius: 8,
          padding: [10, 8, 10, 8],
        },
        statsLabel: {
          fontSize: 8,
          color: "#999",
          margin: [0, 0, 0, 4],
        },
        statsNumber: {
          fontSize: 14,
          bold: true,
          color: "#333",
        },
        statsNumberGreen: {
          fontSize: 14,
          bold: true,
          color: "#6d9f71",
        },
        statsNumberRed: {
          fontSize: 14,
          bold: true,
          color: "#cf6f6f",
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: "#2a3f2c",
        },
        tableHeaderCenter: {
          bold: true,
          fontSize: 10,
          color: "#2a3f2c",
          alignment: "center",
        },
        tableHeaderRight: {
          bold: true,
          fontSize: 10,
          color: "#2a3f2c",
          alignment: "right",
        },
        tableCell: {
          fontSize: 9,
          color: "#333",
        },
        tableCellCenter: {
          fontSize: 9,
          color: "#333",
          alignment: "center",
        },
        tableCellRight: {
          fontSize: 9,
          color: "#333",
          alignment: "right",
        },
        emptyCell: {
          fontSize: 10,
          color: "#999",
          margin: [0, 15, 0, 15],
        },
        dailyTotal: {
          margin: [0, 10, 0, 5],
        },
        dailyTotalLabel: {
          fontSize: 10,
          color: "#666",
          alignment: "right",
        },
        dailyTotalValue: {
          fontSize: 14,
          bold: true,
          color: "#6d9f71",
          alignment: "right",
          margin: [0, 3, 0, 0],
        },
        grandTotal: {
          margin: [0, 20, 0, 0],
        },
        grandTotalLabel: {
          fontSize: 12,
          color: "#666",
          alignment: "right",
        },
        grandTotalValue: {
          fontSize: 22,
          bold: true,
          color: "#6d9f71",
          alignment: "right",
          margin: [0, 5, 0, 0],
        },
        infoLine: {
          fontSize: 8,
          color: "#aaa",
          alignment: "center",
        },
      },

      defaultStyle: {
        font: "Roboto",
      },
    };

    // Имя файла (короткое и понятное)
    let shortFileName = "";
    if (period === "week") {
      const startDay = start.getDate();
      const endDay = end.getDate();
      const monthNames = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
      const month = monthNames[start.getMonth()];
      const year = start.getFullYear();
      shortFileName = `Сменка_${startDay}-${endDay}_${month}_${year}`;
    } else if (period === "month") {
      const monthNames = [
        "январь",
        "февраль",
        "март",
        "апрель",
        "май",
        "июнь",
        "июль",
        "август",
        "сентябрь",
        "октябрь",
        "ноябрь",
        "декабрь",
      ];
      const month = monthNames[start.getMonth()];
      const year = start.getFullYear();
      shortFileName = `Сменка_${month}_${year}`;
    } else {
      shortFileName = `Сменка_${start.getFullYear()}`;
    }

    const fileName = `${shortFileName}.pdf`;

    // Скачивание
    pdfMake.createPdf(docDefinition).download(fileName);
  }

  // ==========================================================================
  // 24. ФОКУС НА ПОЗИЦИЯХ В СВОДКЕ (ПРОКРУТКА ДЛИННЫХ НАЗВАНИЙ)
  // ==========================================================================

  let focusedPosition = null; // храним текущую выбранную позицию

  // Функция для установки фокуса на элементе позиции
  function focusSummaryPosition(element) {
    // Если кликнули по той же позиции — просто оставляем фокус
    if (focusedPosition === element) {
      return;
    }

    // Убираем фокус с предыдущей позиции
    if (focusedPosition) {
      focusedPosition.classList.remove("focused");
      const prevName = focusedPosition.querySelector(".summary-position-name");
      if (prevName) {
        prevName.scrollTo({ left: 0, behavior: "smooth" });
      }
    }

    // Добавляем фокус новой позиции
    element.classList.add("focused");
    focusedPosition = element;

    // Автопрокрутка названия
    const nameElement = element.querySelector(".summary-position-name");
    if (nameElement && nameElement.scrollWidth > nameElement.clientWidth) {
      nameElement.scrollTo({
        left: nameElement.scrollWidth - nameElement.clientWidth,
        behavior: "smooth",
      });
    }
  }

  // Функция снятия фокуса
  function unfocusAll() {
    if (focusedPosition) {
      focusedPosition.classList.remove("focused");
      const nameElement = focusedPosition.querySelector(".summary-position-name");
      if (nameElement) {
        nameElement.scrollTo({ left: 0, behavior: "smooth" });
      }
      focusedPosition = null;
    }
  }

  // Обработчик клика по позиции
  document.addEventListener("click", (e) => {
    const positionItem = e.target.closest(".summary-position-item");
    if (positionItem) {
      e.stopPropagation(); // останавливаем всплытие, чтобы не сработал обработчик документа
      focusSummaryPosition(positionItem);
    }
  });

  // Обработчик клика вне позиций
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".summary-position-item")) {
      unfocusAll();
    }
  });

  // Escape снимает фокус
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      unfocusAll();
    }
  });

  // ==========================================================================
  // 25. СИНХРОНИЗАЦИЯ С GOOGLE SHEETS (JSONP версия)
  // ==========================================================================

  const GS_API_URL =
    "https://script.google.com/macros/s/AKfycbx3wbrgrJmPEPk9djQcKYczaiV_p-xWBNpHCTbuAVXtxzTLLznZRHid-jcLy65tX6H2/exec";

  let pendingQueue = JSON.parse(localStorage.getItem("pendingQueue") || "[]");

  // Функция JSONP-запроса
  function jsonpRequest(url, successCallback, errorCallback) {
    const callbackName = "jsonp_cb_" + Date.now();
    const script = document.createElement("script");

    window[callbackName] = function (data) {
      delete window[callbackName];
      document.body.removeChild(script);
      successCallback(data);
    };

    script.src = url + "&callback=" + callbackName;
    script.onerror = function () {
      delete window[callbackName];
      document.body.removeChild(script);
      errorCallback();
    };

    document.body.appendChild(script);
  }

  // Функция отправки данных (POST с no-cors)
  async function sendToGoogleSheets(data) {
    if (!navigator.onLine) {
      pendingQueue.push({ data, timestamp: Date.now() });
      localStorage.setItem("pendingQueue", JSON.stringify(pendingQueue));
      return false;
    }

    try {
      await fetch(GS_API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (pendingQueue.length > 0) {
        pendingQueue = [];
        localStorage.setItem("pendingQueue", "[]");
      }
      return true;
    } catch (error) {
      console.log("Ошибка отправки:", error);
      pendingQueue.push({ data, timestamp: Date.now() });
      localStorage.setItem("pendingQueue", JSON.stringify(pendingQueue));
      return false;
    }
  }

  // Загрузка данных из облака по email (JSONP)
  async function loadFromCloud(email) {
    if (!email || !navigator.onLine) return false;

    return new Promise((resolve) => {
      jsonpRequest(
        `${GS_API_URL}?type=restore&email=${encodeURIComponent(email)}`,
        (result) => {
          if (result.success && result.data && hasData(result.data)) {
            restoreDataToLocalStorage(result.data);
            updateUI();
            console.log("✅ Данные восстановлены");
            resolve(true);
          } else {
            console.log("❌ Нет данных для восстановления");
            resolve(false);
          }
        },
        () => {
          console.log("❌ Ошибка JSONP");
          resolve(false);
        },
      );
    });
  }

  // Проверка, есть ли реальные данные
  function hasData(data) {
    return (
      (data.days && data.days.length > 0) ||
      (data.positions && data.positions.length > 0) ||
      (data.settings && data.settings.length > 0)
    );
  }

  // Восстановление данных в localStorage
  function restoreDataToLocalStorage(data) {
    console.log("🔄 Восстанавливаем данные:", data);

    // Функция преобразования Excel-времени в HH:MM
    function formatExcelTime(excelTimeStr) {
      if (!excelTimeStr || typeof excelTimeStr !== "string") return "00:00";

      // Если уже в формате HH:MM - возвращаем как есть
      if (excelTimeStr.match(/^\d{2}:\d{2}$/)) return excelTimeStr;

      try {
        const date = new Date(excelTimeStr);
        if (isNaN(date.getTime())) return "00:00";

        const hours = date.getUTCHours().toString().padStart(2, "0");
        const minutes = date.getUTCMinutes().toString().padStart(2, "0");
        return `${hours}:${minutes}`;
      } catch (e) {
        console.log("Ошибка преобразования времени:", excelTimeStr);
        return "00:00";
      }
    }

    // Дни
    if (data.days) {
      console.log("📅 Найдено дней:", data.days.length);
      data.days.forEach((row, index) => {
        console.log(`День ${index}:`, row);
        // Формат: [deviceId, email, date, startTime, endTime, positions, synced]

        // ПРЕОБРАЗУЕМ ДАТУ!
        const isoDate = new Date(row[2]);
        const year = isoDate.getFullYear();
        const month = isoDate.getMonth() + 1;
        const day = isoDate.getDate();
        const dateKey = `${year}-${month}-${day}`;

        // ПРЕОБРАЗУЕМ ВРЕМЯ!
        const startTime = formatExcelTime(row[3]);
        const endTime = formatExcelTime(row[4]);

        const dayData = {
          startTime: startTime,
          endTime: endTime,
          positions: JSON.parse(row[5] || "[]"),
        };

        localStorage.setItem(dateKey, JSON.stringify(dayData));
        console.log(`✅ День ${dateKey} сохранён: ${startTime} - ${endTime}`);
      });
    } else {
      console.log("❌ Нет дней");
    }

    // Позиции
    if (data.positions) {
      console.log("📌 Найдено позиций:", data.positions.length);
      const positions = [];
      data.positions.forEach((row, index) => {
        console.log(`Позиция ${index}:`, row);
        positions.push({
          id: row[2],
          name: row[3],
          price: row[4],
        });
      });
      if (positions.length) {
        localStorage.setItem("positions", JSON.stringify(positions));
        console.log("✅ Позиции сохранены");
      }
    }

    // Настройки
    if (data.settings && data.settings.length) {
      console.log("⚙️ Найдено настроек:", data.settings.length);
      const last = data.settings[data.settings.length - 1];
      console.log("Последние настройки:", last);
      console.log("bonusPercent =", last[2], "teamSize =", last[3]);

      const settings = {
        bonusPercent: last[2],
        teamSize: last[3],
      };
      localStorage.setItem("settings", JSON.stringify(settings));
      console.log("✅ Настройки сохранены:", settings);
    }
  }

  // Обновление интерфейса после восстановления
  function updateUI() {
    updateMainStats();
    renderCalendar();
    if (summaryPage.style.display === "flex") updateSummaryPage();
  }

  // Модалка загрузки (индикатор)
  function showLoadingModal(message) {
    const modal = document.createElement("div");
    modal.id = "loadingModal";
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20000;
  `;
    modal.innerHTML = `
    <div style="
      background: var(--color-bg-secondary);
      padding: 24px;
      border-radius: 24px;
      text-align: center;
      max-width: 200px;
    ">
      <div style="
        border: 4px solid var(--color-bg-tertiary);
        border-top: 4px solid var(--color-accent-primary);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      "></div>
      <p style="color: var(--color-text-primary);">${message}</p>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
    document.body.appendChild(modal);
  }

  function hideLoadingModal() {
    const modal = document.getElementById("loadingModal");
    if (modal) modal.remove();
  }

  // Модалка восстановления (предложение)
  function showRestoreModal(data) {
    const modal = document.createElement("div");
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

    modal.innerHTML = `
    <div style="
      background: var(--color-bg-secondary);
      padding: 24px;
      border-radius: 24px;
      max-width: 320px;
      width: 90%;
      text-align: center;
    ">
      <h3 style="color: var(--color-text-primary); margin-bottom: 12px;">🔄 Восстановить данные?</h3>
      <p style="color: var(--color-text-secondary); font-size: 14px; margin-bottom: 20px;">
        Найдена резервная копия ваших данных. Хотите восстановить?
      </p>
      <div style="display: flex; gap: 8px;">
        <button id="restoreNo" style="
          flex: 1;
          padding: 12px;
          background: var(--color-bg-tertiary);
          border: none;
          border-radius: 12px;
          color: var(--color-text-secondary);
          cursor: pointer;
        ">Нет</button>
        <button id="restoreYes" style="
          flex: 1;
          padding: 12px;
          background: var(--color-accent-muted);
          border: none;
          border-radius: 12px;
          color: var(--color-accent-primary);
          cursor: pointer;
        ">Да</button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    document.getElementById("restoreYes").addEventListener("click", () => {
      restoreDataToLocalStorage(data);
      updateUI();
      modal.remove();
      alert("✅ Данные восстановлены");
    });

    document.getElementById("restoreNo").addEventListener("click", () => {
      modal.remove();
    });
  }

  // Генерация deviceId (по-прежнему нужна для отправки)
  function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
      deviceId = "device_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("deviceId", deviceId);
    }
    return deviceId;
  }

  function showSuccessModal(message) {
    const modal = document.createElement("div");
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20001;
  `;
    modal.innerHTML = `
    <div style="
      background: var(--color-bg-secondary);
      padding: 24px;
      border-radius: 24px;
      max-width: 280px;
      text-align: center;
      animation: fadeInUp 0.3s ease;
    ">
      <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
      <p style="color: var(--color-text-primary); font-size: 16px;">${message}</p>
      <button id="successOk" style="
        margin-top: 20px;
        padding: 12px 24px;
        background: var(--color-accent-muted);
        border: none;
        border-radius: 12px;
        color: var(--color-accent-primary);
        font-weight: 500;
        cursor: pointer;
      ">ОК</button>
    </div>
  `;
    document.body.appendChild(modal);
    document.getElementById("successOk").addEventListener("click", () => modal.remove());
  }

  function showConfirmModal(title, message, onConfirm, onCancel) {
    const modal = document.createElement("div");
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20002;
  `;
    modal.innerHTML = `
    <div style="
      background: var(--color-bg-secondary);
      padding: 24px;
      border-radius: 24px;
      max-width: 300px;
      text-align: center;
      animation: fadeInUp 0.3s ease;
    ">
      <h3 style="color: var(--color-text-primary); margin-bottom: 12px;">${title}</h3>
      <p style="color: var(--color-text-secondary); font-size: 14px; margin-bottom: 24px;">${message}</p>
      <div style="display: flex; gap: 12px;">
        <button id="confirmCancel" style="
          flex: 1;
          padding: 12px;
          background: var(--color-bg-tertiary);
          border: none;
          border-radius: 12px;
          color: var(--color-text-secondary);
          cursor: pointer;
        ">Нет</button>
        <button id="confirmOk" style="
          flex: 1;
          padding: 12px;
          background: var(--color-accent-muted);
          border: none;
          border-radius: 12px;
          color: var(--color-accent-primary);
          cursor: pointer;
        ">Да</button>
      </div>
    </div>
  `;
    document.body.appendChild(modal);
    document.getElementById("confirmOk").addEventListener("click", () => {
      modal.remove();
      onConfirm();
    });
    document.getElementById("confirmCancel").addEventListener("click", () => {
      modal.remove();
      if (onCancel) onCancel();
    });
  }

  // Проверка и запрос email (улучшенная версия)
  function checkAndAskEmail() {
    if (localStorage.getItem("emailAsked") === "true") return;

    const emailModal = document.createElement("div");
    emailModal.id = "emailModal";
    emailModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

    emailModal.innerHTML = `
    <div style="
      background: var(--color-bg-secondary);
      padding: 24px;
      border-radius: 24px;
      max-width: 320px;
      width: 90%;
      text-align: center;
      animation: fadeInUp 0.3s ease;
    ">
      <h3 style="color: var(--color-text-primary); margin-bottom: 12px;">🔐 Вход / Регистрация</h3>
      <p style="color: var(--color-text-secondary); font-size: 14px; margin-bottom: 20px;">
        Введите email, чтобы войти или создать нового пользователя
      </p>
      <input type="email" id="restoreEmail" placeholder="Ваш email" style="
        width: 100%;
        padding: 12px;
        background: var(--color-bg-tertiary);
        border: 1px solid transparent;
        border-radius: 12px;
        color: var(--color-text-primary);
        margin-bottom: 20px;
        box-sizing: border-box;
      ">
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="emailLogin" style="
          flex: 1;
          padding: 12px;
          background: var(--color-accent-muted);
          border: none;
          border-radius: 12px;
          color: var(--color-accent-primary);
          cursor: pointer;
          min-width: 120px;
        ">Войти</button>
        <button id="emailRegister" style="
          flex: 1;
          padding: 12px;
          background: var(--color-bg-tertiary);
          border: none;
          border-radius: 12px;
          color: var(--color-text-secondary);
          cursor: pointer;
          min-width: 120px;
        ">Новый пользователь</button>
      </div>
      <div style="margin-top: 12px;">
        <button id="emailSkip" style="
          padding: 8px 16px;
          background: transparent;
          border: none;
          color: var(--color-text-tertiary);
          font-size: 13px;
          cursor: pointer;
          text-decoration: underline;
        ">Не сейчас</button>
      </div>
    </div>
    <style>
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    </style>
  `;

    document.body.appendChild(emailModal);

    const emailInput = document.getElementById("restoreEmail");
    const loginBtn = document.getElementById("emailLogin");
    const registerBtn = document.getElementById("emailRegister");
    const skipBtn = document.getElementById("emailSkip");

    loginBtn.addEventListener("click", async () => {
      const email = emailInput.value.trim();
      if (!email) return;

      showLoadingModal("Проверка email...");

      const restoreSuccess = await loadFromCloud(email);

      hideLoadingModal();

      if (restoreSuccess) {
        localStorage.setItem("userEmail", email);
        localStorage.setItem("emailAsked", "true");
        emailModal.remove();
        showSuccessModal("✅ Данные восстановлены");
      } else {
        showConfirmModal(
          "Пользователь не найден",
          "Хотите создать нового пользователя с этим email?",
          async () => {
            localStorage.setItem("userEmail", email);
            localStorage.setItem("emailAsked", "true");
            const deviceId = getOrCreateDeviceId();
            await sendToGoogleSheets({ type: "user", deviceId, email });
            emailModal.remove();
            showSuccessModal("👤 Новый пользователь создан");
          },
          () => {},
        );
      }
    });

    registerBtn.addEventListener("click", async () => {
      const email = emailInput.value.trim();
      if (!email) return;

      showLoadingModal("Создание пользователя...");

      localStorage.setItem("userEmail", email);
      localStorage.setItem("emailAsked", "true");

      // Сохраняем старый deviceId или создаём новый
      const deviceId = getOrCreateDeviceId();

      // Отправляем пользователя в облако
      await sendToGoogleSheets({ type: "user", deviceId, email });

      // ОТПРАВЛЯЕМ ВСЕ СУЩЕСТВУЮЩИЕ ДАННЫЕ В ОБЛАКО!
      await syncAllData();

      hideLoadingModal();
      emailModal.remove();
      showSuccessModal("👤 Новый пользователь создан, данные сохранены в облаке");
    });

    skipBtn.addEventListener("click", () => {
      localStorage.setItem("emailAsked", "true");
      emailModal.remove();
    });
  }

  // Функция синхронизации (отправка новых данных)
  async function syncAllData() {
    const deviceId = getOrCreateDeviceId();
    const email = localStorage.getItem("userEmail");
    if (!email || !navigator.onLine) return;

    let lastSync = localStorage.getItem("lastSyncTime") || 0;
    if (lastSync == 0) console.log("Первый запуск синхронизации");

    // Собираем только новые дни
    const days = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
        try {
          const dayData = JSON.parse(localStorage.getItem(key));
          if (!dayData._synced || dayData._synced < lastSync) {
            days.push({ date: key, ...dayData });
          }
        } catch (e) {}
      }
    }

    if (days.length === 0) {
      console.log("Нет новых данных для синхронизации");
      return;
    }

    const now = Date.now();
    for (const day of days) {
      await sendToGoogleSheets({
        type: "day",
        deviceId,
        email,
        date: day.date,
        startTime: day.startTime,
        endTime: day.endTime,
        positions: day.positions,
      });

      const savedDay = localStorage.getItem(day.date);
      if (savedDay) {
        const dayData = JSON.parse(savedDay);
        dayData._synced = now;
        localStorage.setItem(day.date, JSON.stringify(dayData));
      }
    }

    // Отправляем справочник (только если позиции НЕ стандартные)
    const positions = JSON.parse(localStorage.getItem("positions") || "[]");

    // Массив стандартных позиций
    const defaultPositions = [
      { id: 1, name: "Гайка ГЕ8.935.200-02", price: 2.8391 },
      { id: 2, name: "Гайка ГЕ8.935.200-03", price: 2.8391 },
      { id: 3, name: "Гайка ГЕ8.935.200-04", price: 2.8391 },
      { id: 4, name: "Гайка ГЕ8.935.200-05", price: 2.8391 },
      { id: 5, name: "Гайка ГЕ8.935.200-06", price: 3.575 },
      { id: 6, name: "Гайка ГЕ8.935.200-07", price: 3.575 },
      { id: 7, name: "Гайка ГЕ8.935.200-08", price: 3.575 },
      { id: 8, name: "Гайка ГЕ8.935.200-09", price: 3.575 },
      { id: 9, name: "Гайка ГЕ8.935.200-10", price: 3.575 },
      { id: 10, name: "кожух ГЕ8.634.487-02", price: 4.079865 },
      { id: 11, name: "кожух ГЕ8.634.487-03", price: 4.079865 },
      { id: 12, name: "кожух ГЕ8.634.487-04", price: 4.079865 },
      { id: 13, name: "кожух ГЕ8.634.487-05", price: 4.079865 },
      { id: 14, name: "кожух ГЕ8.634.487-06", price: 4.079865 },
      { id: 15, name: "кожух ГЕ8.634.487-07", price: 4.079865 },
      { id: 16, name: "кожух ГЕ8.634.487-08", price: 4.079865 },
      { id: 17, name: "кожух ГЕ8.634.487-09", price: 4.079865 },
      { id: 18, name: "гайка 043", price: 2.55 },
      { id: 19, name: "кожух ГЕ8.634.419", price: 12 },
      { id: 20, name: "кожух ГЕ8.634.419-01", price: 12 },
      { id: 21, name: "кожух ГЕ8.634.419-07", price: 12 },
      { id: 22, name: "кожух ГЕ8.634.419-02", price: 12 },
      { id: 23, name: "кожух ГЕ8.634.419-03", price: 12 },
      { id: 24, name: "кожух ГЕ8.634.419-04", price: 12 },
      { id: 25, name: "кожух ГЕ8.634.419-05", price: 12 },
    ];

    // Функция сравнения массивов позиций
    function isDefaultPositions(arr) {
      if (arr.length !== defaultPositions.length) return false;
      return arr.every(
        (pos, i) =>
          pos.id === defaultPositions[i].id &&
          pos.name === defaultPositions[i].name &&
          Math.abs(pos.price - defaultPositions[i].price) < 0.001, // допускаем погрешность
      );
    }

    const lastPositionsSync = localStorage.getItem("lastPositionsSync") || 0;
    if (!lastPositionsSync || lastPositionsSync < now) {
      // Отправляем только если позиции НЕ стандартные
      if (!isDefaultPositions(positions)) {
        await sendToGoogleSheets({
          type: "positions",
          deviceId,
          email,
          positions,
        });
        console.log("📤 Отправлены кастомные позиции");
      } else {
        console.log("📤 Стандартные позиции не отправляем");
      }
      localStorage.setItem("lastPositionsSync", now);
    }

    // Отправляем настройки
    const settings = JSON.parse(localStorage.getItem("settings") || "{}");
    const lastSettingsSync = localStorage.getItem("lastSettingsSync") || 0;
    if (!lastSettingsSync || lastSettingsSync < now) {
      await sendToGoogleSheets({
        type: "settings",
        deviceId,
        email,
        bonusPercent: settings.bonusPercent || 0,
        teamSize: settings.teamSize || 1,
      });
      localStorage.setItem("lastSettingsSync", now);
    }

    localStorage.setItem("lastSyncTime", now);
  }

  // Запуск при загрузке
  setTimeout(async () => {
    const email = localStorage.getItem("userEmail");
    const hasDays = Object.keys(localStorage).some((k) => k.match(/^\d{4}-\d{1,2}-\d{1,2}$/));
    const hasSettings = localStorage.getItem("settings") && localStorage.getItem("settings") !== "{}";
    const hasPositions = localStorage.getItem("positions") && localStorage.getItem("positions") !== "[]";
    const hasData = hasDays || hasSettings || hasPositions;

    console.log("🔍 Проверка при запуске:", { hasData, email, online: navigator.onLine });

    if (!navigator.onLine) return;

    if (email) {
      if (!hasData) {
        console.log("📥 Есть email, но данных нет. Пытаемся восстановить...");
        showLoadingModal("Восстановление данных...");
        const restored = await loadFromCloud(email);
        hideLoadingModal();
        if (restored) {
          console.log("✅ Данные восстановлены");
        } else {
          console.log("❌ Данные не найдены в облаке");
        }
      } else {
        console.log("📤 Есть данные и email. Синхронизируем...");
        syncAllData();
      }
    } else {
      console.log("📧 Нет email. Спрашиваем...");
      checkAndAskEmail();
    }
  }, 1000);

  window.addEventListener("online", () => {
    console.log("🌐 Интернет появился, синхронизируем...");
    syncAllData();
  });

  // ==========================================================================
  // 26. ЗОНА ВОССТАНОВЛЕНИЯ — РУЧНОЕ ВОССТАНОВЛЕНИЕ ДАННЫХ
  // ==========================================================================

  function restoreDataManually() {
    // Показываем модалку с email (ту же, что при первом запуске)
    // Но с небольшими изменениями — убираем кнопку "Не сейчас"

    const emailModal = document.createElement("div");
    emailModal.id = "restoreManualModal";
    emailModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

    emailModal.innerHTML = `
    <div style="
      background: var(--color-bg-secondary);
      padding: 24px;
      border-radius: 24px;
      max-width: 320px;
      width: 90%;
      text-align: center;
      animation: fadeInUp 0.3s ease;
    ">
      <h3 style="color: var(--color-text-primary); margin-bottom: 12px;">🔄 Восстановление</h3>
      <p style="color: var(--color-text-secondary); font-size: 14px; margin-bottom: 20px;">
        Введите email, чтобы восстановить данные из облака
      </p>
      <input type="email" id="restoreManualEmail" placeholder="Ваш email" style="
        width: 100%;
        padding: 12px;
        background: var(--color-bg-tertiary);
        border: 1px solid transparent;
        border-radius: 12px;
        color: var(--color-text-primary);
        margin-bottom: 20px;
        box-sizing: border-box;
      ">
      <div style="display: flex; gap: 12px;">
        <button id="restoreManualCancel" style="
          flex: 1;
          padding: 12px;
          background: var(--color-bg-tertiary);
          border: none;
          border-radius: 12px;
          color: var(--color-text-secondary);
          cursor: pointer;
        ">Отмена</button>
        <button id="restoreManualConfirm" style="
          flex: 1;
          padding: 12px;
          background: var(--color-accent-muted);
          border: none;
          border-radius: 12px;
          color: var(--color-accent-primary);
          cursor: pointer;
        ">Восстановить</button>
      </div>
    </div>
    <style>
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    </style>
  `;

    document.body.appendChild(emailModal);

    const emailInput = document.getElementById("restoreManualEmail");
    const cancelBtn = document.getElementById("restoreManualCancel");
    const confirmBtn = document.getElementById("restoreManualConfirm");

    cancelBtn.addEventListener("click", () => {
      emailModal.remove();
    });

    confirmBtn.addEventListener("click", async () => {
      const email = emailInput.value.trim();
      if (!email) return;

      showLoadingModal("Восстановление...");

      const restoreSuccess = await loadFromCloud(email);

      hideLoadingModal();

      if (restoreSuccess) {
        emailModal.remove();
        showSuccessModal("✅ Данные восстановлены");
      } else {
        emailModal.remove();
        showErrorModal("❌ Данные не найдены");
      }
    });
  }

  // Добавляем обработчик на кнопку
  document.addEventListener("DOMContentLoaded", () => {
    const restoreBtn = document.getElementById("restoreDataBtn");
    if (restoreBtn) {
      restoreBtn.addEventListener("click", restoreDataManually);
    }
  });

  function showErrorModal(message) {
    const modal = document.createElement("div");
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20001;
  `;
    modal.innerHTML = `
    <div style="
      background: var(--color-bg-secondary);
      padding: 24px;
      border-radius: 24px;
      max-width: 280px;
      text-align: center;
      animation: fadeInUp 0.3s ease;
    ">
      <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
      <p style="color: var(--color-text-primary); font-size: 16px;">${message}</p>
      <button id="errorOk" style="
        margin-top: 20px;
        padding: 12px 24px;
        background: var(--color-accent-muted);
        border: none;
        border-radius: 12px;
        color: var(--color-accent-primary);
        font-weight: 500;
        cursor: pointer;
      ">ОК</button>
    </div>
  `;
    document.body.appendChild(modal);
    document.getElementById("errorOk").addEventListener("click", () => modal.remove());
  }

  // Для отладки — делаем функции глобальными
  window.syncAllData = syncAllData;
  window.loadFromCloud = loadFromCloud;
  window.sendToGoogleSheets = sendToGoogleSheets;
})();
