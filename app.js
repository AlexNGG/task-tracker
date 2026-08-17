/**
 * ==========================================================================
 * Task Tracker PWA — iOS Dark Glassmorphism (Week / Month Architecture)
 * ==========================================================================
 */

const STORAGE_KEY = 'ios_task_tracker_v3';
const LEGACY_KEY_V2 = 'ios_tasks_pwa_v2';
const LEGACY_KEY_V1 = 'ios_tasks_pwa_v1';

// Helper: Format Date to ISO string (YYYY-MM-DD)
function toISODate(d) {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TODAY_ISO = toISODate(new Date());

const INITIAL_DEMO_TASKS = [
  {
    id: 'demo_1_' + Date.now(),
    title: 'Разработать стеклянный переключатель «Неделя / Месяц»',
    status: 'in_progress', // 'todo' | 'in_progress' | 'done'
    type: 'week',          // 'week' | 'month'
    date: TODAY_ISO,
    createdAt: Date.now() - 3600000 * 3,
    completedAt: null
  },
  {
    id: 'demo_2_' + Date.now(),
    title: 'Протестировать 7-дневную ленту с индикаторами активности',
    status: 'todo',
    type: 'week',
    date: TODAY_ISO,
    createdAt: Date.now() - 3600000 * 2,
    completedAt: null
  },
  {
    id: 'demo_3_' + Date.now(),
    title: 'Выпустить релиз Task Tracker v3.0 с поддержкой PWA и Safe Area',
    status: 'todo',
    type: 'month',
    date: TODAY_ISO,
    createdAt: Date.now() - 3600000 * 24,
    completedAt: null
  },
  {
    id: 'demo_4_' + Date.now(),
    title: 'Настроить офлайн Service Worker и эффекты микро-салюта конфетти',
    status: 'done',
    type: 'week',
    date: TODAY_ISO,
    createdAt: Date.now() - 3600000 * 5,
    completedAt: Date.now() - 1800000
  }
];

class TaskTrackerApp {
  constructor() {
    this.tasks = this.loadTasks();
    this.currentHorizon = 'week'; // 'week' | 'month' (Default is Week)
    this.selectedDate = new Date();
    this.currentFilter = 'all';   // 'all' | 'in_progress' | 'todo'
    this.isAccordionExpanded = false;
    this.deletedTaskBackup = null;
    this.toastTimeout = null;

    // Cache DOM Elements
    this.dom = {
      currentDateTitle: document.getElementById('current-date-title'),
      currentDayLabel: document.getElementById('current-day-label'),
      navPrevBtn: document.getElementById('nav-prev-btn'),
      navNextBtn: document.getElementById('nav-next-btn'),
      navTodayBtn: document.getElementById('nav-today-btn'),
      navPeriodText: document.getElementById('nav-period-text'),
      segmentBtns: document.querySelectorAll('.segment-btn'),
      weekStripWrapper: document.getElementById('week-strip-wrapper'),
      weekStrip: document.getElementById('week-strip'),
      monthStatsGrid: document.getElementById('month-stats-grid'),
      statTotalCount: document.getElementById('stat-total-count'),
      statProgressCount: document.getElementById('stat-progress-count'),
      statDoneCount: document.getElementById('stat-done-count'),
      statRatePercent: document.getElementById('stat-rate-percent'),
      progressTitleLabel: document.getElementById('progress-title-label'),
      progressStatsText: document.getElementById('progress-stats-text'),
      progressBarFill: document.getElementById('progress-bar-fill'),
      progressBarTrack: document.getElementById('progress-bar-track'),
      progressBadgeStatus: document.getElementById('progress-badge-status'),
      activeTasksCount: document.getElementById('active-tasks-count'),
      activeTasksList: document.getElementById('active-tasks-list'),
      emptyStateView: document.getElementById('empty-state-view'),
      emptyStateTitle: document.getElementById('empty-state-title'),
      emptyStateSubtitle: document.getElementById('empty-state-subtitle'),
      completedAccordionToggle: document.getElementById('completed-accordion-toggle'),
      completedAccordionTitle: document.getElementById('completed-accordion-title'),
      completedTasksWrapper: document.getElementById('completed-tasks-wrapper'),
      completedTasksList: document.getElementById('completed-tasks-list'),
      completedCountBadge: document.getElementById('completed-count-badge'),
      clearCompletedBtn: document.getElementById('clear-completed-btn'),
      completedSectionContainer: document.getElementById('completed-section-container'),
      addTaskForm: document.getElementById('add-task-form'),
      taskInput: document.getElementById('task-input'),
      addTaskBtn: document.getElementById('add-task-btn'),
      toastContainer: document.getElementById('toast-container'),
      countAll: document.getElementById('count-all'),
      countInProgress: document.getElementById('count-in-progress'),
      countTodo: document.getElementById('count-todo'),
      filterPills: document.querySelectorAll('.filter-pill')
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.render();
    this.registerServiceWorker();
  }

  // --- Storage & Migration ---
  loadTasks() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }

      // Check legacy V2 or V1
      const legacyV2 = localStorage.getItem(LEGACY_KEY_V2) || localStorage.getItem(LEGACY_KEY_V1);
      if (legacyV2) {
        const raw = JSON.parse(legacyV2);
        const migrated = raw.map(t => ({
          id: t.id || Date.now() + Math.random(),
          title: t.title || t.text || 'Задача',
          status: t.status === 'completed' ? 'done' : (t.status === 'in_progress' ? 'in_progress' : 'todo'),
          type: (t.type === 'month') ? 'month' : 'week',
          date: t.date || toISODate(t.createdAt || Date.now()),
          createdAt: t.createdAt || Date.now(),
          completedAt: t.completedAt || null
        }));
        this.saveTasks(migrated);
        return migrated;
      }
    } catch (e) {
      console.warn('Failed to load tasks:', e);
    }

    this.saveTasks(INITIAL_DEMO_TASKS);
    return [...INITIAL_DEMO_TASKS];
  }

  saveTasks(tasksToSave = this.tasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksToSave));
    } catch (e) {
      console.error('Failed to write to storage:', e);
    }
  }

  // --- Date Math Helpers ---
  getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 is Sunday
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(d.setDate(diff));
  }

  getWeekDays(date) {
    const monday = this.getStartOfWeek(date);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const next = new Date(monday);
      next.setDate(monday.getDate() + i);
      days.push(next);
    }
    return days;
  }

  isSameDay(d1, d2) {
    return toISODate(d1) === toISODate(d2);
  }

  isToday(d) {
    return toISODate(d) === toISODate(new Date());
  }

  // --- Audio & Haptic Feedback ---
  triggerHaptic(type = 'light') {
    if (!('vibrate' in navigator)) return;
    try {
      if (type === 'light') navigator.vibrate(10);
      else if (type === 'success') navigator.vibrate([15, 30, 20]);
      else if (type === 'warning') navigator.vibrate([25, 40, 25]);
    } catch (_) {}
  }

  playSoftTone(type = 'pop') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'tap') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.05);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch (_) {}
  }

  launchConfetti() {
    if (typeof confetti !== 'function') return;
    try {
      confetti({
        particleCount: 55,
        spread: 65,
        origin: { y: 0.8 },
        colors: ['#10b981', '#06b6d4', '#f59e0b', '#3b82f6', '#ffffff'],
        disableForReducedMotion: true,
        ticks: 200,
        gravity: 1.1,
        scalar: 0.95
      });
    } catch (e) {
      console.warn('Confetti error:', e);
    }
  }

  // --- Event Bindings ---
  bindEvents() {
    // 1. Segmented Control Switcher (Неделя / Месяц)
    this.dom.segmentBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const horizon = btn.dataset.horizon;
        this.setHorizon(horizon);
      });
    });

    // 2. Navigation
    this.dom.navPrevBtn.addEventListener('click', () => this.navigatePeriod(-1));
    this.dom.navNextBtn.addEventListener('click', () => this.navigatePeriod(1));
    this.dom.navTodayBtn.addEventListener('click', () => {
      this.selectedDate = new Date();
      this.triggerHaptic('light');
      this.render();
    });

    // 3. Add task
    this.dom.addTaskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddTask();
    });

    this.dom.taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleAddTask();
      }
    });

    // 4. Accordion Toggle
    this.dom.completedAccordionToggle.addEventListener('click', () => {
      this.toggleAccordion();
    });

    // 5. Clear completed
    this.dom.clearCompletedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleClearCompleted();
    });

    // 6. Filter Pills
    this.dom.filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const filter = pill.dataset.filter;
        this.setFilter(filter);
      });
    });
  }

  // --- Horizon Management ---
  setHorizon(horizon) {
    if (this.currentHorizon === horizon) return;
    this.currentHorizon = horizon;

    this.dom.segmentBtns.forEach(btn => {
      const isActive = btn.dataset.horizon === horizon;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive.toString());
    });

    this.triggerHaptic('light');
    this.playSoftTone('tap');
    this.render();
  }

  navigatePeriod(delta) {
    const d = new Date(this.selectedDate);

    if (this.currentHorizon === 'week') {
      d.setDate(d.getDate() + delta * 7);
    } else if (this.currentHorizon === 'month') {
      d.setMonth(d.getMonth() + delta);
    }

    this.selectedDate = d;
    this.triggerHaptic('light');
    this.render();
  }

  // --- Task CRUD Operations ---
  handleAddTask() {
    const text = this.dom.taskInput.value.trim();
    if (!text) {
      this.dom.taskInput.focus();
      return;
    }

    const targetDateISO = toISODate(this.selectedDate);

    const newTask = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      title: text,
      status: 'todo', // Default: ⚪️
      type: this.currentHorizon, // 'week' | 'month'
      date: targetDateISO,
      createdAt: Date.now(),
      completedAt: null
    };

    this.tasks.unshift(newTask);
    this.saveTasks();

    this.dom.taskInput.value = '';
    this.dom.taskInput.blur();

    this.triggerHaptic('light');
    this.playSoftTone('tap');

    if (this.currentFilter === 'in_progress') {
      this.setFilter('all');
    } else {
      this.render();
    }
  }

  toggleTaskStatus(taskId) {
    const taskIndex = this.tasks.findIndex(t => String(t.id) === String(taskId));
    if (taskIndex === -1) return;

    const task = this.tasks[taskIndex];
    const cardEl = document.querySelector(`[data-task-id="${taskId}"]`);

    if (task.status === 'todo') {
      // ⚪️ Todo -> ⏳ In Progress
      task.status = 'in_progress';
      this.saveTasks();
      this.triggerHaptic('light');
      this.playSoftTone('tap');
      this.render();

    } else if (task.status === 'in_progress') {
      // ⏳ In Progress -> ✅ Done
      task.status = 'done';
      task.completedAt = Date.now();
      this.saveTasks();

      this.triggerHaptic('success');
      this.playSoftTone('success');
      this.launchConfetti();

      // Celebration Animation
      if (cardEl) {
        cardEl.classList.add('celebrating');
        setTimeout(() => {
          cardEl.classList.remove('celebrating');
          cardEl.classList.add('departing');
          setTimeout(() => {
            this.render();
          }, 380);
        }, 650);
      } else {
        this.render();
      }

    } else if (task.status === 'done') {
      // ✅ Done -> ⚪️ Todo
      task.status = 'todo';
      task.completedAt = null;
      this.saveTasks();
      this.triggerHaptic('light');
      this.playSoftTone('tap');
      this.render();
    }
  }

  deleteTask(taskId) {
    const taskIndex = this.tasks.findIndex(t => String(t.id) === String(taskId));
    if (taskIndex === -1) return;

    const removedTask = this.tasks[taskIndex];
    this.deletedTaskBackup = { task: removedTask, index: taskIndex };

    const cardEl = document.querySelector(`[data-task-id="${taskId}"]`);
    if (cardEl) {
      cardEl.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'translateX(-30px) scale(0.9)';
      
      setTimeout(() => {
        this.tasks.splice(taskIndex, 1);
        this.saveTasks();
        this.render();
        this.showToast('Задача удалена', true);
      }, 250);
    } else {
      this.tasks.splice(taskIndex, 1);
      this.saveTasks();
      this.render();
      this.showToast('Задача удалена', true);
    }

    this.triggerHaptic('warning');
  }

  undoDeleteTask() {
    if (!this.deletedTaskBackup) return;
    const { task, index } = this.deletedTaskBackup;
    this.tasks.splice(index, 0, task);
    this.deletedTaskBackup = null;
    this.saveTasks();
    this.render();
    this.hideToast();
    this.triggerHaptic('light');
  }

  handleClearCompleted() {
    const horizonTasks = this.getTasksForCurrentHorizon();
    const completedHorizonIds = new Set(
      horizonTasks.filter(t => t.status === 'done').map(t => String(t.id))
    );

    if (completedHorizonIds.size === 0) return;

    this.tasks = this.tasks.filter(t => !completedHorizonIds.has(String(t.id)));
    this.saveTasks();
    this.render();
    this.showToast(`Удалено выполненных: ${completedHorizonIds.size}`);
    this.triggerHaptic('light');
  }

  // --- Filtering & Accordion ---
  setFilter(filter) {
    this.currentFilter = filter;
    this.dom.filterPills.forEach(pill => {
      if (pill.dataset.filter === filter) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
    this.triggerHaptic('light');
    this.render();
  }

  toggleAccordion() {
    this.isAccordionExpanded = !this.isAccordionExpanded;
    this.dom.completedAccordionToggle.classList.toggle('expanded', this.isAccordionExpanded);
    this.dom.completedAccordionToggle.setAttribute('aria-expanded', this.isAccordionExpanded.toString());
    this.dom.completedTasksWrapper.classList.toggle('expanded', this.isAccordionExpanded);
    this.triggerHaptic('light');
  }

  // --- Toast Feedback ---
  showToast(message, allowUndo = false) {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.dom.toastContainer.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = 'toast';

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    if (allowUndo) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'toast-undo-btn';
      undoBtn.textContent = 'Отменить';
      undoBtn.onclick = () => this.undoDeleteTask();
      toast.appendChild(undoBtn);
    }

    this.dom.toastContainer.appendChild(toast);

    this.toastTimeout = setTimeout(() => {
      this.hideToast();
    }, 3800);
  }

  hideToast() {
    const toast = this.dom.toastContainer.querySelector('.toast');
    if (toast) {
      toast.classList.add('toast-exit');
      setTimeout(() => {
        this.dom.toastContainer.innerHTML = '';
      }, 300);
    }
  }

  // --- Horizon Query Logic ---
  getTasksForCurrentHorizon() {
    if (this.currentHorizon === 'week') {
      const weekDays = this.getWeekDays(this.selectedDate).map(toISODate);
      const weekSet = new Set(weekDays);
      return this.tasks.filter(t => {
        return (t.type === 'week' || t.type === 'day' || !t.type) && weekSet.has(t.date);
      });
    }

    if (this.currentHorizon === 'month') {
      const year = this.selectedDate.getFullYear();
      const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
      const prefix = `${year}-${month}`;
      return this.tasks.filter(t => t.date && t.date.startsWith(prefix));
    }

    return this.tasks;
  }

  // --- Render Pipeline ---
  render() {
    this.renderHeaderAndNav();
    this.renderHorizonViews();
    this.renderTaskLists();
  }

  renderHeaderAndNav() {
    const now = new Date();
    const selected = this.selectedDate;

    // 1. Current Today Title
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    let formattedToday = now.toLocaleDateString('ru-RU', options);
    if (formattedToday) {
      formattedToday = formattedToday.charAt(0).toUpperCase() + formattedToday.slice(1);
    }
    this.dom.currentDateTitle.textContent = formattedToday;

    // 2. Horizon Navigation Bar
    if (this.currentHorizon === 'week') {
      const weekDays = this.getWeekDays(selected);
      const start = weekDays[0];
      const end = weekDays[6];
      const startStr = start.getDate();
      const endStr = end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      this.dom.navPeriodText.textContent = `${startStr} – ${endStr}`;
      
      const currentWeekMonday = this.getStartOfWeek(new Date());
      const isThisWeek = this.isSameDay(start, currentWeekMonday);
      this.dom.navTodayBtn.textContent = 'Тек. неделя';
      this.dom.navTodayBtn.classList.toggle('hidden', isThisWeek);
      this.dom.progressTitleLabel.textContent = 'Прогресс недели';
      this.dom.completedAccordionTitle.textContent = 'Сделано за неделю';
      this.dom.taskInput.placeholder = 'Что нужно сделать на этой неделе?';

    } else if (this.currentHorizon === 'month') {
      let monthText = selected.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
      monthText = monthText.charAt(0).toUpperCase() + monthText.slice(1);
      this.dom.navPeriodText.textContent = monthText;
      
      const isThisMonth = selected.getFullYear() === now.getFullYear() && selected.getMonth() === now.getMonth();
      this.dom.navTodayBtn.textContent = 'Тек. месяц';
      this.dom.navTodayBtn.classList.toggle('hidden', isThisMonth);
      this.dom.progressTitleLabel.textContent = 'Прогресс месяца';
      this.dom.completedAccordionTitle.textContent = 'Сделано за месяц';
      this.dom.taskInput.placeholder = `Цель на ${selected.toLocaleDateString('ru-RU', { month: 'long' })}...`;
    }
  }

  renderHorizonViews() {
    // 1. Toggle Horizon Components
    this.dom.weekStripWrapper.classList.toggle('hidden', this.currentHorizon !== 'week');
    this.dom.monthStatsGrid.classList.toggle('hidden', this.currentHorizon !== 'month');

    // 2. Render 7-Day Week Strip
    if (this.currentHorizon === 'week') {
      this.dom.weekStrip.innerHTML = '';
      const weekDays = this.getWeekDays(this.selectedDate);
      const shortDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

      weekDays.forEach((dayDate, idx) => {
        const dayISO = toISODate(dayDate);
        const isSelected = this.isSameDay(dayDate, this.selectedDate);
        const isTodayDay = this.isToday(dayDate);

        // Status dot for this day
        const dayTasks = this.tasks.filter(t => t.date === dayISO);
        let dotClass = '';
        if (dayTasks.length > 0) {
          const hasProgress = dayTasks.some(t => t.status === 'in_progress');
          const allDone = dayTasks.every(t => t.status === 'done');
          if (allDone) {
            dotClass = 'dot-done';
          } else if (hasProgress) {
            dotClass = 'dot-progress';
          } else {
            dotClass = 'dot-todo';
          }
        }

        const chip = document.createElement('div');
        chip.className = `day-chip ${isSelected ? 'active' : ''} ${isTodayDay ? 'is-today' : ''}`;
        chip.role = 'tab';
        chip.setAttribute('aria-selected', isSelected.toString());
        chip.innerHTML = `
          <span class="day-chip-name">${shortDays[idx]}</span>
          <span class="day-chip-num">${dayDate.getDate()}</span>
          <span class="day-chip-dot ${dotClass}"></span>
        `;

        chip.onclick = () => {
          this.selectedDate = dayDate;
          this.triggerHaptic('light');
          this.render();
        };

        this.dom.weekStrip.appendChild(chip);
      });
    }

    // 3. Render Month Statistics
    if (this.currentHorizon === 'month') {
      const monthTasks = this.getTasksForCurrentHorizon();
      const total = monthTasks.length;
      const progress = monthTasks.filter(t => t.status === 'in_progress').length;
      const done = monthTasks.filter(t => t.status === 'done').length;
      const rate = total > 0 ? Math.round((done / total) * 100) : 0;

      this.dom.statTotalCount.textContent = total;
      this.dom.statProgressCount.textContent = progress;
      this.dom.statDoneCount.textContent = done;
      this.dom.statRatePercent.textContent = `${rate}%`;
    }
  }

  renderTaskLists() {
    const horizonTasks = this.getTasksForCurrentHorizon();
    const totalCount = horizonTasks.length;
    const completedTasks = horizonTasks.filter(t => t.status === 'done');
    const inProgressTasks = horizonTasks.filter(t => t.status === 'in_progress');
    const todoTasks = horizonTasks.filter(t => t.status === 'todo');
    const activeTasks = horizonTasks.filter(t => t.status !== 'done');

    // 1. Update Badges
    this.dom.countAll.textContent = activeTasks.length;
    this.dom.countInProgress.textContent = inProgressTasks.length;
    this.dom.countTodo.textContent = todoTasks.length;
    this.dom.completedCountBadge.textContent = completedTasks.length;
    this.dom.activeTasksCount.textContent = activeTasks.length;

    // 2. Update Progress Bar
    const completedCount = completedTasks.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    this.dom.progressBarFill.style.width = `${progressPercent}%`;
    this.dom.progressBarTrack.setAttribute('aria-valuenow', progressPercent);
    this.dom.progressStatsText.textContent = `${completedCount} из ${totalCount} сделано • ${progressPercent}%`;

    if (totalCount > 0 && completedCount === totalCount) {
      this.dom.progressBadgeStatus.textContent = 'Все готово! 🎉';
      this.dom.progressBadgeStatus.className = 'progress-badge all-done';
    } else if (inProgressTasks.length > 0) {
      this.dom.progressBadgeStatus.textContent = `В фокусе: ${inProgressTasks.length}`;
      this.dom.progressBadgeStatus.className = 'progress-badge';
    } else {
      this.dom.progressBadgeStatus.textContent = 'Планирование';
      this.dom.progressBadgeStatus.className = 'progress-badge';
    }

    // 3. Filter Active Tasks
    let filteredActive = activeTasks;
    if (this.currentFilter === 'in_progress') {
      filteredActive = inProgressTasks;
    } else if (this.currentFilter === 'todo') {
      filteredActive = todoTasks;
    }

    this.dom.activeTasksList.innerHTML = '';

    if (filteredActive.length === 0) {
      this.dom.emptyStateView.classList.remove('hidden');
      if (this.currentFilter === 'in_progress') {
        this.dom.emptyStateTitle.textContent = 'Нет задач в работе';
        this.dom.emptyStateSubtitle.textContent = 'Нажмите на индикатор задачи, чтобы перевести её в статус «В работе»';
      } else if (this.currentFilter === 'todo') {
        this.dom.emptyStateTitle.textContent = 'План пуст';
        this.dom.emptyStateSubtitle.textContent = 'Добавьте новую задачу с помощью строки ввода внизу';
      } else {
        this.dom.emptyStateTitle.textContent = totalCount > 0 ? 'Все задачи периода закрыты!' : 'Нет задач на этот период';
        this.dom.emptyStateSubtitle.textContent = totalCount > 0 ? 'Отличный результат! Можно отдохнуть' : 'Добавьте задачу с помощью строки ввода внизу';
      }
    } else {
      this.dom.emptyStateView.classList.add('hidden');

      if (this.currentHorizon === 'week') {
        // Group by days
        const groupedByDate = {};
        filteredActive.forEach(t => {
          const dKey = t.date || TODAY_ISO;
          if (!groupedByDate[dKey]) groupedByDate[dKey] = [];
          groupedByDate[dKey].push(t);
        });

        Object.keys(groupedByDate).sort().forEach(dateKey => {
          const dateObj = new Date(dateKey + 'T00:00:00');
          let label = dateObj.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'short' });
          label = label.charAt(0).toUpperCase() + label.slice(1);

          const groupHeader = document.createElement('li');
          groupHeader.className = 'week-group-header';
          groupHeader.textContent = label;
          this.dom.activeTasksList.appendChild(groupHeader);

          groupedByDate[dateKey].forEach(task => {
            this.dom.activeTasksList.appendChild(this.createTaskCardElement(task));
          });
        });

      } else {
        filteredActive.forEach(task => {
          this.dom.activeTasksList.appendChild(this.createTaskCardElement(task));
        });
      }
    }

    // 4. Render Completed Accordion
    this.dom.completedTasksList.innerHTML = '';
    if (completedTasks.length > 0) {
      this.dom.clearCompletedBtn.classList.remove('hidden');
      completedTasks.forEach(task => {
        this.dom.completedTasksList.appendChild(this.createTaskCardElement(task));
      });
    } else {
      this.dom.clearCompletedBtn.classList.add('hidden');
    }
  }

  // --- Task Card Builder ---
  createTaskCardElement(task) {
    const li = document.createElement('li');
    li.className = `task-card status-${task.status}`;
    li.setAttribute('data-task-id', task.id);

    // Status Button (⚪️ -> ⏳ -> ✅)
    const statusBtn = document.createElement('button');
    statusBtn.className = 'status-btn';
    statusBtn.setAttribute('aria-label', `Статус: ${this.getStatusLabel(task.status)}`);
    statusBtn.onclick = () => this.toggleTaskStatus(task.id);

    if (task.status === 'todo') {
      statusBtn.innerHTML = `<span class="status-icon-todo" title="Запланировано"></span>`;
    } else if (task.status === 'in_progress') {
      statusBtn.innerHTML = `<span class="status-icon-progress" title="В работе"></span>`;
    } else if (task.status === 'done') {
      statusBtn.innerHTML = `
        <span class="status-icon-done" title="Выполнено">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
      `;
    }
    li.appendChild(statusBtn);

    // Task Body
    const taskBody = document.createElement('div');
    taskBody.className = 'task-body';

    const taskText = document.createElement('div');
    taskText.className = 'task-text';
    taskText.textContent = task.title;
    taskBody.appendChild(taskText);

    // Metadata (Status Tag + Type Badge + Time)
    const taskMeta = document.createElement('div');
    taskMeta.className = 'task-meta';

    const statusPill = document.createElement('span');
    statusPill.className = `task-status-pill ${task.status}`;
    statusPill.textContent = this.getStatusLabel(task.status);
    taskMeta.appendChild(statusPill);

    if (task.type === 'month') {
      const typeBadge = document.createElement('span');
      typeBadge.className = 'task-type-badge';
      typeBadge.textContent = 'Месяц';
      taskMeta.appendChild(typeBadge);
    }

    const timeStr = this.formatTime(task.createdAt);
    const timeSpan = document.createElement('span');
    timeSpan.textContent = timeStr;
    taskMeta.appendChild(timeSpan);

    taskBody.appendChild(taskMeta);
    li.appendChild(taskBody);

    // Task Delete Action
    const taskActions = document.createElement('div');
    taskActions.className = 'task-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'task-delete-btn';
    deleteBtn.setAttribute('aria-label', 'Удалить задачу');
    deleteBtn.title = 'Удалить';
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
      </svg>
    `;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      this.deleteTask(task.id);
    };
    taskActions.appendChild(deleteBtn);
    li.appendChild(taskActions);

    // Attach touch swipe gesture
    this.attachSwipeHandler(li, task.id);

    return li;
  }

  attachSwipeHandler(element, taskId) {
    let startX = 0;
    let currentX = 0;
    let isSwiping = false;

    element.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isSwiping = true;
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
      if (!isSwiping) return;
      currentX = e.touches[0].clientX;
      const diffX = currentX - startX;

      if (diffX < 0 && diffX > -120) {
        element.style.transform = `translateX(${diffX}px)`;
      }
    }, { passive: true });

    element.addEventListener('touchend', () => {
      if (!isSwiping) return;
      isSwiping = false;
      const diffX = currentX - startX;

      if (diffX < -70) {
        this.deleteTask(taskId);
      } else {
        element.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        element.style.transform = 'translateX(0)';
        setTimeout(() => {
          element.style.transition = '';
        }, 250);
      }
    }, { passive: true });
  }

  getStatusLabel(status) {
    switch (status) {
      case 'todo': return 'План';
      case 'in_progress': return 'В работе';
      case 'done': return 'Готово';
      default: return '';
    }
  }

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // --- Service Worker Offline Registration ---
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('PWA ServiceWorker active with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('PWA ServiceWorker registration failed:', err);
          });
      });
    }
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.taskTrackerApp = new TaskTrackerApp();
});
