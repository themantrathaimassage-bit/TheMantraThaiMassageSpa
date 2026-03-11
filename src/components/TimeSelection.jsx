import React, { useState, useMemo } from 'react';
import styles from './TimeSelection.module.css';

const PERIODS = [
    { key: 'morning', label: 'Morning', icon: '🌅', test: h => h < 12 },
    { key: 'afternoon', label: 'Afternoon', icon: '☀️', test: h => h >= 12 && h < 17 },
    { key: 'evening', label: 'Evening', icon: '🌙', test: h => h >= 17 },
];

// ── Store Hours (fixed, independent of Square config) ──────────────────────
const STORE_OPEN_HOUR = 10;   // 10:00 AM
const STORE_CLOSE_HOUR = 21;   // 9:00 PM

// Last booking slot shown in the grid
const LAST_BOOKING_HOUR = 20;
const LAST_BOOKING_MIN = 30;
const LAST_BOOKING_MINS = LAST_BOOKING_HOUR * 60 + LAST_BOOKING_MIN; // 1230

// Overtime threshold — sessions ending after 21:00 incur surcharge
const CLOSE_HOUR = 21;
const CLOSE_TOTAL_MINS = CLOSE_HOUR * 60; // 1260
const OVERTIME_RATE = 5;   // AUD per 15 min
const MAX_OVERTIME_MINS = 120; // Cannot book if overtime exceeds 2 hours

// Returns raw overtime MINUTES (0 if none)
const calcOvertimeMins = (startTimeStr, durationMins) => {
    const startMins = parseInt(startTimeStr.split(':')[0]) * 60 + parseInt(startTimeStr.split(':')[1]);
    const endMins = startMins + durationMins;
    return Math.max(0, endMins - CLOSE_TOTAL_MINS);
};

// Returns overtime CHARGE in AUD (rounds up to nearest 15-min block)
const calcOvertime = (startTimeStr, durationMins) => {
    const overMins = calcOvertimeMins(startTimeStr, durationMins);
    if (overMins <= 0) return 0;
    return Math.ceil(overMins / 15) * OVERTIME_RATE;
};

const formatTime12 = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const TimeSelection = ({ guests, activeGuestId, onGuestSwitch, onSelect, staffMembers = [] }) => {
    const LOCATION_ID = 'LY3JYWKY4FHHQ';
    const activeGuest = guests?.find(g => g.id === activeGuestId) || guests?.[0];

    // Generate next 90 days for the scroller
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
            const gDate = new Date(activeGuest.time.date.date);
            return dates.find(d =>
                d.date.getDate() === gDate.getDate() &&
                d.date.getMonth() === gDate.getMonth() &&
                d.date.getFullYear() === gDate.getFullYear()
            ) || dates[0];
        }
        return dates[0];
    });

    const [selectedTime, setSelectedTime] = useState(null);
    const [pendingSelection, setPendingSelection] = useState(null);
    const [showFullCalendar, setShowFullCalendar] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const [availableSlots, setAvailableSlots] = useState([]); // List of "HH:MM"
    const [availabilityMap, setAvailabilityMap] = useState({}); // "HH:MM" -> Array of availability objects
    const [isLoading, setIsLoading] = useState(false);
    const [isSearchingNext, setIsSearchingNext] = useState(false);

    const [popupMessage, setPopupMessage] = useState(null);
    const [hasShownOrderAlert, setHasShownOrderAlert] = useState(false);

    // Alert for reordered guests
    React.useEffect(() => {
        if (!guests || guests.length <= 1 || hasShownOrderAlert) return;

        const sortedGuests = [...guests].sort((a, b) => (a.staff?.id === 'any' ? 1 : b.staff?.id === 'any' ? -1 : 0));
        const isReordered = JSON.stringify(sortedGuests.map(g => g.id)) !== JSON.stringify(guests.map(g => g.id));

        if (isReordered) {
            const specific = sortedGuests.filter(g => g.staff?.id !== 'any');
            const names = specific.map(g => g.name).join(' and ');
            setPopupMessage(`${names} will select their time first because they have specified a professional.`);
            setHasShownOrderAlert(true);
        }
    }, [guests, hasShownOrderAlert]);


    // Sync selected time and date when switching guest
    React.useEffect(() => {
        setSelectedTime(activeGuest?.time?.time || null);
        if (activeGuest?.time?.date) {
            const gDate = new Date(activeGuest.time.date.date);
            const matched = dates.find(d =>
                d.date.getDate() === gDate.getDate() &&
                d.date.getMonth() === gDate.getMonth() &&
                d.date.getFullYear() === gDate.getFullYear()
            );
            if (matched) setSelectedDate(matched);
        }
    }, [activeGuestId, activeGuest?.time?.time, activeGuest?.time?.date, dates]);

    const bookableServices = activeGuest?.services?.filter(s => s.durationMs > 0) || [];
    const onlyAddons = activeGuest?.services?.length > 0 && bookableServices.length === 0;

    const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const getGuestDurationMinutes = (guest) => {
        const bookable = guest?.services?.filter(s => s.durationMs > 0) || [];
        const ms = bookable.reduce((sum, s) => sum + (s.durationMs || 0), 0);
        return Math.ceil(ms / 60000);
    };

    const activeGuestDuration = useMemo(() => getGuestDurationMinutes(activeGuest), [activeGuest]);

    const otherGuestsTimes = useMemo(() => {
        return guests
            .filter(g => g.id !== activeGuestId && g.time)
            .map(g => {
                const start = timeToMinutes(g.time.time);
                const end = start + getGuestDurationMinutes(g);
                const staffIds = g.time.availability?.appointment_segments?.map(s => s.team_member_id) || [];
                if (staffIds.length === 0 && g.staff?.id && g.staff.id !== 'any') {
                    staffIds.push(g.staff.id);
                }
                return { start, end, staffIds };
            });
    }, [guests, activeGuestId]);

    const isSlotBlocked = React.useCallback((timeStr, segments = []) => {
        const start = timeToMinutes(timeStr);
        const end = start + activeGuestDuration;

        // 1. Find who is already occupied by the group during this window
        const occupiedStaffIds = otherGuestsTimes
            .filter(g => start < g.end && end > g.start)
            .flatMap(g => g.staffIds);

        // 2. Conflict check
        if (activeGuest.staff?.id && activeGuest.staff.id !== 'any') {
            // Specific staff requested: Block if they are in occupied list
            return occupiedStaffIds.includes(activeGuest.staff.id);
        } else {
            // "Any Staff":
            if (segments.length === 0) return false; // Handled by isTaken logic
            // Free if at least ONE of Square's availability options doesn't use occupied staff
            const hasFreeOption = segments.some(seg => {
                const requiredIds = seg.appointment_segments?.map(s => s.team_member_id) || [];
                return !requiredIds.some(id => occupiedStaffIds.includes(id));
            });
            return !hasFreeOption;
        }
    }, [activeGuestDuration, otherGuestsTimes, activeGuest.staff]);

    const guestServicesKey = JSON.stringify(bookableServices.map(s => s.id));
    const guestStaffId = activeGuest?.staff?.id;

    // Lock body scroll when confirmation modal is open
    React.useEffect(() => {
        if (pendingSelection) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [pendingSelection]);

    // Fetch Availability
    React.useEffect(() => {
        const fetchAvailability = async () => {
            if (!activeGuestId || !selectedDate) return;
            if (activeGuest?.services?.length === 0) {
                setAvailableSlots([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            if (!activeGuest?.time) setSelectedTime(null);

            try {
                const year = selectedDate.year;
                const month = String(selectedDate.date.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.dayNum).padStart(2, '0');
                // Fixed store hours: 10 AM open, midnight close
                const startAt = `${year}-${month}-${day}T${String(STORE_OPEN_HOUR).padStart(2, '0')}:00:00+11:00`;
                const endAt = `${year}-${month}-${day}T23:59:59+11:00`;

                const fetchOptions = (staffId) => {
                    return fetch('/api/square/v2/bookings/availability/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: {
                                filter: {
                                    location_id: LOCATION_ID,
                                    start_at_range: { start_at: startAt, end_at: endAt },
                                    segment_filters: (bookableServices.length > 0 ? bookableServices : activeGuest.services).map(s => ({
                                        service_variation_id: s.id,
                                        team_member_id_filter: staffId && staffId !== 'any'
                                            ? { any: [staffId] } : undefined
                                    }))
                                }
                            }
                        })
                    }).then(res => res.json()).then(data => data.availabilities || []).catch(() => []);
                };

                let allAvs = [];
                if ((!guestStaffId || guestStaffId === 'any') && staffMembers && staffMembers.length > 0) {
                    // Fetch all staff members individually to get the true matrix of available times
                    const promises = staffMembers.map(staff => fetchOptions(staff.id));
                    const results = await Promise.all(promises);
                    allAvs = results.flat();
                } else {
                    // Specific staff or no staff list available
                    allAvs = await fetchOptions(guestStaffId);
                }

                if (allAvs.length > 0) {
                    const newMap = {};
                    const slots = new Set();
                    const now = new Date();
                    allAvs.forEach(av => {
                        const t = new Date(av.start_at);
                        if (t.getTime() < now.getTime()) return; // Only filter out past times, not near-future ones.

                        const h = String(t.getHours()).padStart(2, '0');
                        const m = String(t.getMinutes()).padStart(2, '0');
                        const timeStr = `${h}:${m}`;

                        // Prevent duplicate availability objects if they have exactly the same start time and staff
                        if (!newMap[timeStr]) newMap[timeStr] = [];
                        const exists = newMap[timeStr].some(e =>
                            e.appointment_segments?.[0]?.team_member_id === av.appointment_segments?.[0]?.team_member_id
                        );
                        if (!exists) {
                            newMap[timeStr].push(av);
                            slots.add(timeStr);
                        }
                    });

                    setAvailabilityMap(newMap);
                    setAvailableSlots([...slots].sort());
                } else {
                    setAvailabilityMap({});
                    setAvailableSlots([]);
                }
            } catch (error) {
                console.error('Availability fetch error:', error);
                setAvailableSlots([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAvailability();
    }, [selectedDate, activeGuestId, guestStaffId, guestServicesKey, onlyAddons]);

    // Fixed grid 10:00–20:30 (last booking cutoff).
    // Square data highlights confirmed slots; no Square data = dim but selectable.
    // Only multi-guest conflict = Busy (blocked).
    const grouped = useMemo(() => {
        if (!activeGuest) return [];

        const allPossible = [];
        for (let h = 10; h <= LAST_BOOKING_HOUR; h++) {
            for (let m = 0; m < 60; m += 15) {
                const total = h * 60 + m;
                if (total > LAST_BOOKING_MINS) break;
                allPossible.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            }
        }

        // Also include already-confirmed time for this guest/date
        const confirmedTime = activeGuest?.time?.date?.id === selectedDate.id
            ? activeGuest.time.time : null;
        if (confirmedTime && !allPossible.includes(confirmedTime)) {
            allPossible.push(confirmedTime);
            allPossible.sort();
        }

        const now = new Date();
        const isToday = selectedDate.date.toDateString() === now.toDateString();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        return PERIODS.map(p => {
            const periodSlots = allPossible.filter(s => {
                const hour = parseInt(s.split(':')[0]);
                if (!p.test(hour)) return false;
                if (isToday && timeToMinutes(s) < currentMins) return false;
                return true;
            });
            return {
                ...p,
                slots: periodSlots,
                availableCount: periodSlots.filter(s => availableSlots.includes(s)).length
            };
        }).filter(p => p.slots.length > 0);
    }, [selectedDate, availableSlots, activeGuest]);

    const handleCalendarDateSelect = (date) => {
        if (!date) return;
        const matched = dates.find(d =>
            d.date.getDate() === date.getDate() &&
            d.date.getMonth() === date.getMonth() &&
            d.date.getFullYear() === date.getFullYear()
        );
        if (matched) { setSelectedDate(matched); setShowFullCalendar(false); }
    };

    const searchNextAvailable = async () => {
        if (bookableServices.length === 0) return;
        setIsSearchingNext(true);
        const idx = dates.findIndex(d => d.id === selectedDate.id);
        for (let i = idx + 1; i < dates.length; i++) {
            const d = dates[i];
            const startAt = `${d.year}-${String(d.date.getMonth() + 1).padStart(2, '0')}-${String(d.dayNum).padStart(2, '0')}T00:00:00+11:00`;
            const endAt = `${d.year}-${String(d.date.getMonth() + 1).padStart(2, '0')}-${String(d.dayNum).padStart(2, '0')}T23:59:59+11:00`;
            try {
                const res = await fetch('/api/square/v2/bookings/availability/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: {
                            filter: {
                                location_id: LOCATION_ID,
                                start_at_range: { start_at: startAt, end_at: endAt },
                                segment_filters: bookableServices.map(s => ({
                                    service_variation_id: s.id,
                                    team_member_id_filter: guestStaffId && guestStaffId !== 'any' ? { any: [guestStaffId] } : undefined
                                }))
                            }
                        }
                    })
                });
                const data = await res.json();
                if (data.availabilities?.length > 0) {
                    setSelectedDate(d);
                    setIsSearchingNext(false);
                    return;
                }
            } catch (e) { }
        }
        setIsSearchingNext(false);
        alert('No slots found in 90 days.');
    };

    const selectedDateLabel = selectedDate.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className={`${styles.container} ${guests?.length === 1 ? styles.singleGuest : ''}`}>
            {/* Guest tabs */}
            {guests && guests.length > 1 && (
                <div className={styles.guestTabs}>
                    {[...guests].sort((a, b) => (a.staff?.id === 'any' ? 1 : b.staff?.id === 'any' ? -1 : 0)).map(guest => {
                        const isLocked = guest.staff?.id === 'any' && guests.some(g => g.staff?.id !== 'any' && !g.time) && !guest.time;
                        return (
                            <button key={guest.id} disabled={isLocked} className={`${styles.guestTab} ${activeGuestId === guest.id ? styles.guestTabActive : ''} ${guest.time ? styles.guestTabDone : ''} ${isLocked ? styles.guestTabLocked : ''}`} onClick={() => !isLocked && onGuestSwitch(guest.id)}>
                                <span className={styles.guestTabName}>{guest.name}</span>
                                {guest.time ? <span className={styles.guestTabTime}>{guest.time.time} · {guest.time.date.dayName} {guest.time.date.dayNum}</span> : <span className={styles.guestTabPending}>{isLocked ? 'Wait for others' : 'Select time'}</span>}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Selecting for label */}
            {guests?.length > 1 && activeGuest && (
                <p className={styles.selectingFor}>
                    Selecting time for <strong>{activeGuest.name}</strong>
                    {activeGuest.staff && <span className={styles.selectingForStaff}> · {activeGuest.staff.id === 'any' ? 'Any available' : activeGuest.staff.name}</span>}
                </p>
            )}

            {/* Date Strip */}
            <div className={styles.header}>
                <h2 className={styles.title}>Select time</h2>
                <button className={styles.calendarToggle} onClick={() => setShowFullCalendar(!showFullCalendar)}>{showFullCalendar ? '← Strip' : '📅 Calendar'}</button>
            </div>

            {showFullCalendar ? (
                <div className={styles.fullCalendar}>
                    <div className={styles.calendarHeader}>
                        <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))}>‹</button>
                        <span className={styles.currentMonth}>{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                        <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))}>›</button>
                    </div>
                    <div className={styles.calendarGrid}>
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className={styles.weekday}>{d}</div>)}
                        {Array.from({ length: 42 }).map((_, i) => {
                            const year = viewDate.getFullYear();
                            const month = viewDate.getMonth();
                            const date = new Date(year, month, i - new Date(year, month, 1).getDay() + 1);
                            if (date.getMonth() !== month) return <div key={i} className={styles.emptyDay} />;
                            const isSelectable = dates.some(d => d.date.toDateString() === date.toDateString());
                            const isSelected = selectedDate.date.toDateString() === date.toDateString();
                            return (
                                <button key={i} disabled={!isSelectable} className={`${styles.dayBtn} ${isSelected ? styles.selectedDay : ''} ${!isSelectable ? styles.disabledDay : ''}`} onClick={() => handleCalendarDateSelect(date)}>
                                    {date.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div id="date-scroller" className={styles.dateScroller}>
                    {dates.map(item => (
                        <button key={item.id} id={`date-item-${item.id}`} className={`${styles.dateItem} ${selectedDate.id === item.id ? styles.selectedDate : ''}`} onClick={() => setSelectedDate(item)}>
                            <span className={styles.dayName}>{item.dayName}</span>
                            <span className={styles.dayNum}>{item.dayNum}</span>
                            <span className={styles.month}>{item.month}</span>
                        </button>
                    ))}
                </div>
            )}

            <p className={styles.selectedDateLabel}>{selectedDateLabel}</p>

            {/* Slots Area */}
            {onlyAddons ? (
                <div className={styles.addonOnlyNotice}>
                    <span className={styles.noSlotsIcon}>✨</span>
                    <p>Add-ons don't require a specific time slot.</p>
                    <button className={styles.confirmBtn} style={{ marginTop: 16 }} onClick={() => onSelect(activeGuest.id, selectedDate, 'Add-on')}>Confirm Add-on →</button>
                </div>
            ) : isLoading ? (
                <div className={styles.loading}><div className={styles.spinner} /><p>Checking availability…</p></div>
            ) : availableSlots.length === 0 ? (
                <div className={styles.noSlots}>
                    <span className={styles.noSlotsIcon}>📭</span>
                    <p>No available slots for {selectedDateLabel}.</p>
                    <button className={styles.nextAvailableBtn} disabled={isSearchingNext} onClick={searchNextAvailable}>{isSearchingNext ? 'Searching…' : 'Go to next available →'}</button>
                </div>
            ) : (
                <div className={styles.slotsContainer}>
                    {grouped.map(period => (
                        <div key={period.key} className={styles.periodBlock}>
                            <div className={styles.periodHeader}>
                                <span className={styles.periodIcon}>{period.icon}</span>
                                <span className={styles.periodLabel}>{period.label}</span>
                                <span className={styles.periodCount}>{period.availableCount} available</span>
                            </div>
                            <div className={styles.pillGrid}>
                                {period.slots.map(time => {
                                    const segments = availabilityMap[time] || [];
                                    const isSquareAvailable = availableSlots.includes(time);
                                    const isConfirmed = activeGuest?.time?.time === time && activeGuest?.time?.date.id === selectedDate.id;
                                    const isBlocked = isSlotBlocked(time, segments) && !isConfirmed;
                                    const overtimeMins = calcOvertimeMins(time, activeGuestDuration);
                                    const overtime = calcOvertime(time, activeGuestDuration);
                                    const isTooLate = overtimeMins > MAX_OVERTIME_MINS && !isConfirmed;
                                    // Block dim slots: not in Square's availability and not already confirmed
                                    const isUnavailable = !isSquareAvailable && !isConfirmed;

                                    let pillClass = styles.pill;
                                    if (isBlocked || isTooLate || isUnavailable) pillClass += ` ${styles.pillBlocked}`;
                                    else if (isConfirmed && overtime > 0) pillClass += ` ${styles.pillConfirmedOT}`;
                                    else if (isConfirmed) pillClass += ` ${styles.pillConfirmed}`;
                                    else if (overtime > 0) pillClass += ` ${styles.pillOvertime}`;

                                    return (
                                        <button key={time} disabled={isBlocked || isTooLate || isUnavailable} className={pillClass} onClick={() => {
                                            const start = timeToMinutes(time);
                                            const end = start + activeGuestDuration;
                                            const occupiedIds = otherGuestsTimes
                                                .filter(g => start < g.end && end > g.start)
                                                .flatMap(g => g.staffIds);

                                            const best = segments.find(seg => {
                                                const req = seg.appointment_segments?.map(s => s.team_member_id) || [];
                                                return !req.some(id => occupiedIds.includes(id));
                                            }) || segments[0];

                                            setPendingSelection({ time, date: selectedDate, availability: best });
                                        }}>
                                            <span className={styles.slotTime}>{time}</span>
                                            {(isBlocked || isTooLate || isUnavailable) && (
                                                <span className={styles.blockedLabel}>{isTooLate ? 'Too Late' : isUnavailable ? 'Taken' : 'Busy'}</span>
                                            )}
                                            {!isBlocked && !isTooLate && !isUnavailable && overtime > 0 && (
                                                <span className={styles.overtimeLabel}>+${overtime} OT</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Time Confirmation Modal */}
            {pendingSelection && (() => {
                const otMins = calcOvertimeMins(pendingSelection.time, activeGuestDuration);
                const overtime = calcOvertime(pendingSelection.time, activeGuestDuration);
                const endMins = timeToMinutes(pendingSelection.time) + activeGuestDuration;
                const endHH = String(Math.floor(endMins / 60)).padStart(2, '0');
                const endMM = String(endMins % 60).padStart(2, '0');
                return (
                    <div className={styles.modalOverlay} onClick={() => setPendingSelection(null)}>
                        <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
                            <div className={styles.confirmHeader}>
                                <div className={styles.confirmIcon}>{overtime > 0 ? '⚠️' : '🕒'}</div>
                                <h3>Confirm your time</h3>
                                <p>For <strong>{activeGuest?.name}</strong></p>
                            </div>
                            <div className={styles.confirmDetails}>
                                <div className={styles.detailRow}><span className={styles.detailLabel}>Date</span><span className={styles.detailValue}>{pendingSelection.date.dayName}, {pendingSelection.date.dayNum} {pendingSelection.date.month}</span></div>
                                <div className={styles.detailRow}><span className={styles.detailLabel}>Time</span><span className={styles.detailValue}>{formatTime12(pendingSelection.time)} – {formatTime12(`${endHH}:${endMM}`)}</span></div>
                                <div className={styles.detailRow}><span className={styles.detailLabel}>Professional</span><span className={styles.detailValue}>{activeGuest.staff?.id === 'any' ? 'Any available' : activeGuest.staff?.name}</span></div>
                            </div>

                            {overtime > 0 && (
                                <div className={styles.overtimeWarning}>
                                    <span className={styles.overtimeIcon}>🌙</span>
                                    <div>
                                        <p className={styles.overtimeTitle}>After-hours surcharge applies</p>
                                        <p className={styles.overtimeDesc}>
                                            Your session ends at <strong>{formatTime12(`${endHH}:${endMM}`)}</strong> — <strong>{otMins} min</strong> after our closing time (9:00 PM).
                                        </p>
                                        <p className={styles.overtimeCharge}>
                                            Overtime charge: <strong>${overtime} AUD</strong>
                                            <span className={styles.overtimeNote}> ($5 per 15 min over closing)</span>
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className={styles.confirmActions}>
                                <button className={styles.cancelLink} onClick={() => setPendingSelection(null)}>Change</button>
                                <button className={styles.confirmSlotBtn} onClick={() => {
                                    onSelect(activeGuest.id, pendingSelection.date, pendingSelection.time, pendingSelection.availability);
                                    setPendingSelection(null);
                                }}>
                                    {overtime > 0 ? `Confirm (+$${overtime} overtime)` : 'Confirm & Continue'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Reorder Info Modal */}
            {popupMessage && (
                <div className={styles.modalOverlay} onClick={() => setPopupMessage(null)}>
                    <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.confirmHeader}>
                            <div className={styles.confirmIcon}>ℹ️</div>
                            <h3 style={{ marginTop: '8px' }}>Booking Order</h3>
                        </div>
                        <div className={styles.confirmDetails} style={{ padding: '20px 0', textAlign: 'center', fontSize: '15.5px', color: '#4b5563', lineHeight: '1.5' }}>
                            {popupMessage}
                        </div>
                        <div className={styles.confirmActions}>
                            <button className={styles.confirmSlotBtn} style={{ width: '100%', display: 'flex', justifyContent: 'center' }} onClick={() => setPopupMessage(null)}>
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeSelection;
