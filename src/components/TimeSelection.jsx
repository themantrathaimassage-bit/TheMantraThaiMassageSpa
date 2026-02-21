import React, { useState, useMemo } from 'react';
import styles from './TimeSelection.module.css';

const PERIODS = [
    { key: 'morning', label: 'Morning', icon: '🌅', test: h => h < 12 },
    { key: 'afternoon', label: 'Afternoon', icon: '☀️', test: h => h >= 12 && h < 17 },
    { key: 'evening', label: 'Evening', icon: '🌙', test: h => h >= 17 },
];

const TimeSelection = ({ guests, activeGuestId, onGuestSwitch, onSelect }) => {
    // LOCATION_ID is used in the search body, so we keep it here or import it
    const LOCATION_ID = 'LY3JYWKY4FHHQ';

    const activeGuest = guests?.find(g => g.id === activeGuestId) || guests?.[0];

    // Generate next 90 days
    const dates = useMemo(() => {
        return Array.from({ length: 90 }, (_, i) => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + i);
            return {
                id: d.getTime(),
                date: d,
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNum: d.getDate(),
                month: d.toLocaleDateString('en-US', { month: 'short' }),
                year: d.getFullYear()
            };
        });
    }, []);

    const [selectedDate, setSelectedDate] = useState(() => {
        if (activeGuest?.time?.date) {
            // Re-sync with the local dates array for consistent reference comparison
            const gDate = new Date(activeGuest.time.date.date);
            const matched = dates.find(d =>
                d.date.getDate() === gDate.getDate() &&
                d.date.getMonth() === gDate.getMonth() &&
                d.date.getFullYear() === gDate.getFullYear()
            );
            return matched || dates[0];
        }
        return dates[0];
    });
    const [selectedTime, setSelectedTime] = useState(null);
    const [pendingSelection, setPendingSelection] = useState(null); // { time, date, availability }
    const [showFullCalendar, setShowFullCalendar] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const [availableSlots, setAvailableSlots] = useState([]);
    const [availabilityMap, setAvailabilityMap] = useState({}); // timeStr -> availability object from Square
    const [isLoading, setIsLoading] = useState(false);
    const [isSearchingNext, setIsSearchingNext] = useState(false);

    // Sync selected time and date when switching guest
    React.useEffect(() => {
        setSelectedTime(activeGuest?.time?.time || null);

        if (activeGuest?.time?.date) {
            // Attempt to re-sync with the local dates array for consistent reference comparison
            const gDate = new Date(activeGuest.time.date.date);
            const matched = dates.find(d =>
                d.date.getDate() === gDate.getDate() &&
                d.date.getMonth() === gDate.getMonth() &&
                d.date.getFullYear() === gDate.getFullYear()
            );
            if (matched) {
                setSelectedDate(matched);
            }
        }
    }, [activeGuestId, activeGuest?.time?.time, activeGuest?.time?.date, dates]);

    // Only bookable services (durationMs > 0) need a time slot.
    // Add-ons (durationMs === 0) are excluded from availability search.
    const bookableServices = activeGuest?.services?.filter(s => s.durationMs > 0) || [];
    const onlyAddons = activeGuest?.services?.length > 0 && bookableServices.length === 0;

    // ── Staff Conflict Logic ──
    const timeToMinutes = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const getGuestDurationMinutes = (guest) => {
        const bookable = guest?.services?.filter(s => s.durationMs > 0) || [];
        const ms = bookable.reduce((sum, s) => sum + (s.durationMs || 0), 0);
        return Math.ceil(ms / 60000);
    };

    const busyIntervals = useMemo(() => {
        if (!activeGuest || !selectedDate || !guests) return [];
        return guests
            .filter(g => g.id !== activeGuestId && g.time && g.staff)
            .filter(g => {
                const sameStaff = g.staff.id !== 'any' && g.staff.id === activeGuest.staff?.id;
                // Rehydrate date comparison
                const gDate = g.time.date?.date instanceof Date ? g.time.date.date : new Date(g.time.date?.date);
                const sameDay = gDate.toDateString() === selectedDate.date.toDateString();
                return sameStaff && sameDay;
            })
            .map(g => {
                const start = timeToMinutes(g.time.time);
                const duration = getGuestDurationMinutes(g);
                return { start, end: start + duration };
            });
    }, [guests, activeGuestId, activeGuest?.staff, selectedDate]);

    const activeGuestDuration = useMemo(() => getGuestDurationMinutes(activeGuest), [activeGuest]);

    const isSlotBlocked = (timeStr) => {
        const start = timeToMinutes(timeStr);
        const end = start + activeGuestDuration;
        return busyIntervals.some(interval => start < interval.end && end > interval.start);
    };

    // Stable dependencies for availability fetch to prevent re-triggering when 'time' is updated
    const guestServicesKey = JSON.stringify(bookableServices.map(s => s.id));
    const guestStaffId = activeGuest?.staff?.id;

    // Fetch Availability
    React.useEffect(() => {
        const fetchAvailability = async () => {
            if (!activeGuestId || !selectedDate) return;

            // If no services at all, skip
            if (activeGuest?.services?.length === 0) {
                setAvailableSlots([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            // Only reset selected time if it's not already set correctly from parent
            if (!activeGuest?.time) {
                setSelectedTime(null);
            }

            try {
                const year = selectedDate.year;
                const month = String(selectedDate.date.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.dayNum).padStart(2, '0');
                const startAt = `${year}-${month}-${day}T00:00:00+11:00`;
                const endAt = `${year}-${month}-${day}T23:59:59+11:00`;

                // Use bookable services first, but fallback to ALL services if none are >0ms
                const searchServices = bookableServices.length > 0 ? bookableServices : activeGuest.services;

                const body = {
                    query: {
                        filter: {
                            location_id: LOCATION_ID,
                            start_at_range: { start_at: startAt, end_at: endAt },
                            segment_filters: searchServices.map(s => ({
                                service_variation_id: s.id,
                                team_member_id_filter: guestStaffId && guestStaffId !== 'any'
                                    ? { any: [guestStaffId] }
                                    : undefined
                            }))
                        }
                    }
                };

                const response = await fetch('/api/square/v2/bookings/availability/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                const data = await response.json();
                if (data.availabilities) {
                    const newMap = {};
                    const rawSlots = data.availabilities.map(av => {
                        const t = new Date(av.start_at);
                        const timeStr = t.toLocaleTimeString('en-US', {
                            hour: '2-digit', minute: '2-digit', hour12: false
                        });
                        if (!newMap[timeStr]) newMap[timeStr] = av;
                        return t;
                    });
                    rawSlots.sort((a, b) => a - b);

                    const expanded = new Set();
                    const now = new Date();
                    const leadTimeMs = 15 * 60000;

                    rawSlots.forEach(t => {
                        const base = new Date(t);
                        const mins = base.getMinutes();
                        const roundedMins = Math.floor(mins / 15) * 15;
                        base.setMinutes(roundedMins, 0, 0);

                        [0, 15].forEach(offset => {
                            const candidate = new Date(base.getTime() + offset * 60000);
                            if (candidate.getTime() >= now.getTime() + leadTimeMs) {
                                expanded.add(candidate.toLocaleTimeString('en-US', {
                                    hour: '2-digit', minute: '2-digit', hour12: false
                                }));
                            }
                        });
                    });

                    setAvailabilityMap(newMap);
                    setAvailableSlots([...expanded].sort());
                } else {
                    setAvailabilityMap({});
                    setAvailableSlots([]);
                }
            } catch (error) {
                setAvailableSlots([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAvailability();
    }, [selectedDate, activeGuestId, guestStaffId, guestServicesKey, onlyAddons]);

    // Calendar logic
    const calendarDays = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
        return days;
    }, [viewDate]);

    const handleCalendarDateSelect = (date) => {
        if (!date) return;
        const found = dates.find(d =>
            d.date.getDate() === date.getDate() &&
            d.date.getMonth() === date.getMonth() &&
            d.date.getFullYear() === date.getFullYear()
        );
        if (found) { setSelectedDate(found); setShowFullCalendar(false); }
    };

    // Auto-scroll date strip
    React.useEffect(() => {
        if (!showFullCalendar && selectedDate) {
            const timer = setTimeout(() => {
                const scroller = document.getElementById('date-scroller');
                const target = document.getElementById(`date-item-${selectedDate.id}`);
                if (scroller && target) {
                    scroller.scrollTo({
                        left: target.offsetLeft - scroller.clientWidth / 2 + target.clientWidth / 2,
                        behavior: 'smooth'
                    });
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showFullCalendar, selectedDate]);

    const handleConfirm = () => {
        if (selectedTime && activeGuest) {
            // Pass the availability object so BookingPage can extract team_member_id
            const availability = availabilityMap[selectedTime] || null;
            onSelect(activeGuest.id, selectedDate, selectedTime, availability);
        }
    };

    const searchNextAvailable = async () => {
        if (bookableServices.length === 0) return;
        setIsSearchingNext(true);
        const currentIndex = dates.findIndex(d => d.id === selectedDate.id);
        for (let i = currentIndex + 1; i < dates.length; i++) {
            const d = dates[i];
            const year = d.year;
            const month = String(d.date.getMonth() + 1).padStart(2, '0');
            const day = String(d.dayNum).padStart(2, '0');
            const body = {
                query: {
                    filter: {
                        location_id: LOCATION_ID,
                        start_at_range: {
                            start_at: `${year}-${month}-${day}T00:00:00+11:00`,
                            end_at: `${year}-${month}-${day}T23:59:59+11:00`
                        },
                        // Only bookable services in segment_filters
                        segment_filters: bookableServices.map(s => ({
                            service_variation_id: s.id,
                            team_member_id_filter: activeGuest.staff && activeGuest.staff.id !== 'any'
                                ? { any: [activeGuest.staff.id] } : undefined
                        }))
                    }
                }
            };
            try {
                const res = await fetch('/api/square/v2/bookings/availability/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (data.availabilities && data.availabilities.length > 0) {
                    setSelectedDate(d);
                    setIsSearchingNext(false);
                    return;
                }
            } catch (e) { /* continue */ }
        }
        setIsSearchingNext(false);
        alert('No available slots found in the next 90 days.');
    };

    // Group slots by period
    const grouped = PERIODS.map(p => ({
        ...p,
        slots: availableSlots.filter(s => p.test(parseInt(s.split(':')[0])))
    })).filter(p => p.slots.length > 0);

    const selectedDateLabel = selectedDate.date.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
    });

    return (
        <div className={`${styles.container} ${guests?.length === 1 ? styles.singleGuest : ''}`}>

            {/* ── Guest tabs for time selection ── */}
            {guests && guests.length > 1 && (
                <div className={styles.guestTabs}>
                    {guests.map(guest => {
                        const isActive = activeGuestId === guest.id;
                        const isDone = !!guest.time;
                        return (
                            <button
                                key={guest.id}
                                className={`${styles.guestTab} ${isActive ? styles.guestTabActive : ''} ${isDone ? styles.guestTabDone : ''}`}
                                onClick={() => onGuestSwitch && onGuestSwitch(guest.id)}
                            >
                                <span className={styles.guestTabName}>{guest.name}</span>
                                {isDone ? (
                                    <span className={styles.guestTabTime}>
                                        {guest.time.time} · {guest.time.date.dayName} {guest.time.date.dayNum} {guest.time.date.month}
                                    </span>
                                ) : (
                                    <span className={styles.guestTabPending}>Select time</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}


            {/* ── Selecting for label ── */}
            {guests && guests.length > 1 && activeGuest && (
                <p className={styles.selectingFor}>
                    Selecting time for <strong>{activeGuest.name}</strong>
                    {activeGuest.staff && (
                        <span className={styles.selectingForStaff}> · {activeGuest.staff.id === 'any' ? 'Any available' : activeGuest.staff.name}</span>
                    )}
                </p>
            )}

            {/* ── Date strip header ── */}
            <div className={styles.header}>
                <h2 className={styles.title}>Select time</h2>
                <button
                    className={styles.calendarToggle}
                    onClick={() => setShowFullCalendar(!showFullCalendar)}
                >
                    {showFullCalendar ? '← Strip' : '📅 Calendar'}
                </button>
            </div>

            {/* ── Full calendar ── */}
            {showFullCalendar ? (
                <div className={styles.fullCalendar}>
                    <div className={styles.calendarHeader}>
                        <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))}>‹</button>
                        <span className={styles.currentMonth}>
                            {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))}>›</button>
                    </div>
                    <div className={styles.calendarGrid}>
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                            <div key={d} className={styles.weekday}>{d}</div>
                        ))}
                        {calendarDays.map((date, i) => {
                            if (!date) return <div key={`e-${i}`} className={styles.emptyDay} />;
                            const isSelectable = dates.some(d =>
                                d.date.getDate() === date.getDate() &&
                                d.date.getMonth() === date.getMonth() &&
                                d.date.getFullYear() === date.getFullYear()
                            );
                            const isSelected =
                                selectedDate.date.getDate() === date.getDate() &&
                                selectedDate.date.getMonth() === date.getMonth();
                            return (
                                <button
                                    key={i}
                                    disabled={!isSelectable}
                                    className={`${styles.dayBtn} ${isSelected ? styles.selectedDay : ''} ${!isSelectable ? styles.disabledDay : ''}`}
                                    onClick={() => handleCalendarDateSelect(date)}
                                >
                                    {date.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* ── Horizontal date strip ── */
                <div id="date-scroller" className={styles.dateScroller}>
                    {dates.map(item => (
                        <button
                            key={item.id}
                            id={`date-item-${item.id}`}
                            className={`${styles.dateItem} ${selectedDate.id === item.id ? styles.selectedDate : ''}`}
                            onClick={() => setSelectedDate(item)}
                        >
                            <span className={styles.dayName}>{item.dayName}</span>
                            <span className={styles.dayNum}>{item.dayNum}</span>
                            <span className={styles.month}>{item.month}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* ── Selected date label ── */}
            <p className={styles.selectedDateLabel}>{selectedDateLabel}</p>

            {/* ── Slots area ── */}
            {onlyAddons ? (
                // Guest only has add-ons — no time slot needed
                <div className={styles.addonOnlyNotice}>
                    <span className={styles.noSlotsIcon}>✨</span>
                    <p>Add-ons don't require a specific time slot.</p>
                    <p className={styles.addonOnlySubtext}>Your add-on will be applied to your appointment.</p>
                    <button
                        className={styles.confirmBtn}
                        style={{ marginTop: 16 }}
                        onClick={() => onSelect(activeGuest.id, selectedDate, 'Add-on')}
                    >
                        Confirm Add-on →
                    </button>
                </div>
            ) : isLoading ? (
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <p>Checking availability…</p>
                </div>
            ) : availableSlots.length === 0 ? (
                <div className={styles.noSlots}>
                    <span className={styles.noSlotsIcon}>📭</span>
                    <p>No available slots for this date.</p>
                    <button
                        className={styles.nextAvailableBtn}
                        disabled={isSearchingNext}
                        onClick={searchNextAvailable}
                    >
                        {isSearchingNext ? (
                            <><span className={styles.btnSpinner} /> Searching…</>
                        ) : (
                            <>Go to next available →</>
                        )}
                    </button>
                </div>
            ) : (
                <div className={styles.slotsContainer}>
                    {grouped.map(period => (
                        <div key={period.key} className={styles.periodBlock}>
                            <div className={styles.periodHeader}>
                                <span className={styles.periodIcon}>{period.icon}</span>
                                <span className={styles.periodLabel}>{period.label}</span>
                                <span className={styles.periodCount}>{period.slots.length} slots</span>
                            </div>
                            <div className={styles.pillGrid}>
                                {period.slots.map(time => {
                                    const isDateMatch = activeGuest?.time?.date &&
                                        new Date(activeGuest.time.date.date).toDateString() === selectedDate.date.toDateString();
                                    const isConfirmed = isDateMatch && activeGuest?.time?.time === time;
                                    const isSelected = isDateMatch && selectedTime === time;
                                    const isBlocked = isSlotBlocked(time) && !isConfirmed;

                                    let pillClass = styles.pill;
                                    if (isConfirmed) pillClass += ` ${styles.pillConfirmed}`;
                                    else if (isSelected) pillClass += ` ${styles.pillSelected}`;
                                    else if (isBlocked) pillClass += ` ${styles.pillBlocked}`;

                                    return (
                                        <button
                                            key={time}
                                            disabled={isBlocked}
                                            className={pillClass}
                                            onClick={() => {
                                                const availability = availabilityMap[time] || null;
                                                setPendingSelection({ time, date: selectedDate, availability });
                                            }}
                                        >
                                            <span className={styles.slotTime}>{time}</span>
                                            {isBlocked && <span className={styles.blockedLabel}>Taken</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}


            {/* ── Confirmation Modal ── */}
            {pendingSelection && (
                <div className={styles.modalOverlay} onClick={() => setPendingSelection(null)}>
                    <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.confirmHeader}>
                            <div className={styles.confirmIcon}>🕒</div>
                            <h3>Confirm your time</h3>
                            <p>For <strong>{activeGuest?.name}</strong></p>
                        </div>

                        <div className={styles.confirmDetails}>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Date</span>
                                <span className={styles.detailValue}>
                                    {pendingSelection.date.dayName}, {pendingSelection.date.dayNum} {pendingSelection.date.month}
                                </span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Time</span>
                                <span className={styles.detailValue}>{pendingSelection.time}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Professional</span>
                                <span className={styles.detailValue}>
                                    {activeGuest.staff?.id === 'any' ? 'Any available' : activeGuest.staff?.name}
                                </span>
                            </div>
                        </div>

                        <div className={styles.confirmActions}>
                            <button
                                className={styles.cancelLink}
                                onClick={() => setPendingSelection(null)}
                            >
                                Change
                            </button>
                            <button
                                className={styles.confirmSlotBtn}
                                onClick={() => {
                                    onSelect(activeGuest.id, pendingSelection.date, pendingSelection.time, pendingSelection.availability);
                                    setPendingSelection(null);
                                }}
                            >
                                Confirm & Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeSelection;
