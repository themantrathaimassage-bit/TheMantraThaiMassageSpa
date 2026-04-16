import React, { useState, useEffect, useMemo } from 'react';
import { FiX, FiChevronLeft, FiPhone } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import ServiceList from '../components/ServiceList';
import StaffSelection from '../components/StaffSelection';
import TimeSelection from '../components/TimeSelection';
import CartSummary from '../components/CartSummary';
import GuestSelector from '../components/GuestSelector';
import BookingSuccessModal from '../components/BookingSuccessModal';
import BookingErrorModal from '../components/BookingErrorModal';
import CashOnlyModal from '../components/CashOnlyModal';
import { fetchSquareServices, createSquareBookings, getOvertimeVariation } from '../data/squareCatalog';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import styles from './BookingPage.module.css';

import { staffData } from '../data/staffData';

const BookingPage = () => {
    const { selectedServices, clearCart } = useCart();
    const { user, openAuth } = useAuth();
    // Restore step from sessionStorage so back-navigation doesn't reset it
    const [currentStep, setCurrentStep] = useState(() => {
        try { return parseInt(sessionStorage.getItem('bk_step') || '1', 10); } catch { return 1; }
    });
    const [services, setServices] = useState([]);
    const [staff, setStaff] = useState(staffData); // Default to static data
    const [servicesLoading, setServicesLoading] = useState(true);
    const [staffLoading, setStaffLoading] = useState(false);
    const [isBooking, setIsBooking] = useState(false);
    const [bookingResult, setBookingResult] = useState(null); // null | 'success' | 'error'
    const [bookingErrors, setBookingErrors] = useState([]);
    const [successGuests, setSuccessGuests] = useState(null);
    const [showCashModal, setShowCashModal] = useState(false);

    // 1. Fetch live catalog and staff on mount (Pre-fetch for speed)
    useEffect(() => {
        // Fetch services
        fetchSquareServices().then(liveServices => {
            if (liveServices && liveServices.length > 0) {
                setServices(liveServices);
            }
            setServicesLoading(false);
        });

        // Fetch team members
        import('../data/squareCatalog').then(m => m.fetchSquareTeamMembers()).then(team => {
            if (team && team.length > 0) {
                const formattedTeam = team.map(m => ({
                    id: m.id,
                    name: m.name || 'Professional',
                    image: m.image || null
                }));
                // Filter to ensure unique IDs (just in case of overlap or data issues)
                const uniqueTeam = [];
                const seenIds = new Set();
                formattedTeam.forEach(member => {
                    if (!seenIds.has(member.id)) {
                        seenIds.add(member.id);
                        uniqueTeam.push(member);
                    }
                });
                setStaff([{ id: 'any', name: 'Any professional', image: null }, ...uniqueTeam]);
            } else {
                console.warn('Square API returned no team members, using offline fallback.');
                setStaff(staffData);
            }
        }).catch(err => {
            console.error('Failed to load team members from Square:', err);
            setStaff(staffData); // Fallback on error
        });
    }, []);

    // 2. Add a deliberate "Visual Pulse" when switching to Step 2
    // This makes the transition feel real and gives customers a sense of "fetching"
    const [visualLoading, setVisualLoading] = useState(false);
    useEffect(() => {
        if (currentStep === 2) {
            setVisualLoading(true);
            const timer = setTimeout(() => {
                setVisualLoading(false);
            }, 600); // 600ms is the sweet spot for a "noticeable but fast" transition
            return () => clearTimeout(timer);
        }
    }, [currentStep]);

    // Group Booking State — restored from sessionStorage if available
    const [guests, setGuests] = useState(() => {
        try {
            const saved = sessionStorage.getItem('bk_guests');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Rehydrate Date objects — JSON.stringify converts Date → string
                return parsed.map(g => ({
                    ...g,
                    time: g.time ? {
                        ...g.time,
                        date: g.time.date ? {
                            ...g.time.date,
                            date: g.time.date.date ? new Date(g.time.date.date) : null,
                        } : null,
                    } : null,
                }));
            }
        } catch { }
        return [{ id: 'guest-1', name: 'Guest 1', services: selectedServices, staff: null, time: null }];
    });
    const [activeGuestId, setActiveGuestId] = useState(() => {
        try { return sessionStorage.getItem('bk_activeGuest') || 'guest-1'; } catch { return 'guest-1'; }
    });

    // Persist booking state to sessionStorage whenever it changes
    useEffect(() => {
        try { sessionStorage.setItem('bk_guests', JSON.stringify(guests)); } catch { }
    }, [guests]);
    useEffect(() => {
        try { sessionStorage.setItem('bk_step', String(currentStep)); } catch { }
    }, [currentStep]);
    useEffect(() => {
        try { sessionStorage.setItem('bk_activeGuest', activeGuestId); } catch { }
    }, [activeGuestId]);

    // Sync services from home page if they exist and aren't already in Guest 1
    useEffect(() => {
        if (selectedServices.length > 0) {
            setGuests(prev => {
                const guest1 = prev[0];
                const existingIds = new Set(guest1.services.map(s => s.id));
                const newServices = selectedServices.filter(s => !existingIds.has(s.id));

                if (newServices.length > 0) {
                    return prev.map((g, i) => i === 0
                        ? { ...g, services: [...g.services, ...newServices] }
                        : g
                    );
                }
                return prev;
            });
            // Reset to step 1 so the user sees their updated selection
            setCurrentStep(1);
            // Clear the bridge cart after syncing so it doesn't double-add later
            clearCart();
        }
    }, [selectedServices]);

    // Memoized Guest management
    const activeGuest = useMemo(() =>
        guests.find(g => g.id === activeGuestId) || guests[0],
        [guests, activeGuestId]);

    const updateGuest = React.useCallback((guestId, updates) => {
        setGuests(prev => prev.map(g => g.id === guestId ? { ...g, ...updates } : g));
    }, []);

    const handleServiceSelect = React.useCallback((service) => {
        if (isMaintenanceMode) {
            setBookingResult('maintenance');
            return;
        }
        // If it's an add-on already selected → toggle off (remove)
        if (service.isAddon) {
            const alreadySelected = activeGuest.services.find(s => s.id === service.id);
            if (alreadySelected) {
                updateGuest(activeGuestId, {
                    services: activeGuest.services.filter(s => s.id !== service.id),
                    time: null
                });
                return;
            }
        }
        const existingIndex = activeGuest.services.findIndex(s => s.baseServiceName === service.baseServiceName);
        if (existingIndex > -1) {
            const newServices = [...activeGuest.services];
            newServices[existingIndex] = service;
            updateGuest(activeGuestId, { services: newServices, time: null });
        } else {
            updateGuest(activeGuestId, { services: [...activeGuest.services, service], time: null });
        }
    }, [activeGuest, activeGuestId, updateGuest]);

    const handleStaffSelect = React.useCallback((staff) => {
        updateGuest(activeGuestId, { staff });
    }, [activeGuestId, updateGuest]);

    const getNextGuestIdForTime = (allGuests) => {
        const remaining = allGuests.filter(g => g.time === null);
        if (remaining.length === 0) return null;

        // Prioritize guests with a specific professional
        const specific = remaining.find(g => g.staff && g.staff.id !== 'any');
        if (specific) return specific.id;

        // Then those with "Any professional"
        return remaining[0].id;
    };

    const handleTimeSelect = React.useCallback((guestId, date, time, availability) => {
        setGuests(prev => {
            const guest = prev.find(g => g.id === guestId);
            if (!guest) return prev;

            // Compute overtime for this guest's total bookable duration
            const durationMs = (guest.services || []).filter(s => s.durationMs > 0)
                .reduce((sum, s) => sum + s.durationMs, 0);
            const durationMins = Math.ceil(durationMs / 60000);
            const [h, m] = time.split(':').map(Number);
            const startMins = h * 60 + m;
            const CLOSE_MINS = 21 * 60; // 21:00
            const endMins = startMins + durationMins;
            const overtimeMins = Math.max(0, endMins - CLOSE_MINS);
            const overtimeAmount = Math.ceil(overtimeMins / 15) * 5;
            const overtimeVariation = getOvertimeVariation(overtimeAmount, overtimeMins);

            // Remove any previous overtime charge from services
            const servicesWithoutOT = (guest.services || []).filter(s => !s.isOvertime);
            // Add new overtime service if applicable
            const newServices = overtimeVariation
                ? [...servicesWithoutOT, overtimeVariation]
                : servicesWithoutOT;

            const staffId = guest.staff?.id;
            const updatedGuest = { ...guest, services: newServices, time: { date, time, availability, staffId } };
            const updatedGuests = prev.map(g => g.id === guestId ? updatedGuest : g);

            // Move to next guest needing time
            const nextId = getNextGuestIdForTime(updatedGuests);
            if (nextId) setActiveGuestId(nextId);
            else setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);

            return updatedGuests;
        });
    }, []);

    // Check if any selected service is a Cash Only promo
    const hasCashOnlyService = guests.some(g =>
        g.services.some(s => s.name?.toLowerCase().includes('cash only') || s.baseServiceName?.toLowerCase().includes('cash only'))
    );

    const isMaintenanceMode = true;

    const handleBook = async () => {
        if (!user) {
            openAuth({ returnTo: '/booking' });
            return;
        }
        
        if (isMaintenanceMode) {
            setBookingResult('maintenance');
            return;
        }

        // Show cash-only confirmation first
        if (hasCashOnlyService) {
            setShowCashModal(true);
            return;
        }
        await executeBooking();
    };

    const handleCashConfirm = async () => {
        setShowCashModal(false);
        await executeBooking();
    };

    const executeBooking = async () => {
        setIsBooking(true);
        setBookingResult(null);
        setBookingErrors([]);
        try {
            const results = await createSquareBookings(guests, user.squareCustomerId);
            const errors = results.filter(r => r.error);
            if (errors.length > 0) {
                setBookingErrors(errors.map(e => `${e.guest}: ${e.error}`));
                setBookingResult('error');
            } else {
                setSuccessGuests([...guests]);
                setBookingResult('success');
                clearCart();
                setGuests([{ id: 'guest-1', name: 'Guest 1', services: [], staff: null, time: null }]);
                sessionStorage.removeItem('bk_guests');
                sessionStorage.removeItem('bk_step');
                sessionStorage.removeItem('bk_activeGuest');
                const event = new CustomEvent('closeMobileOverlay');
                window.dispatchEvent(event);
            }
        } catch (err) {
            setBookingErrors([err.message]);
            setBookingResult('error');
        } finally {
            setIsBooking(false);
        }
    };

    const handleRetryBooking = () => {
        setBookingResult(null);
        setBookingErrors([]);

        // Clear selected times for all guests to force re-selection
        const clearedGuests = guests.map(g => ({ ...g, time: null }));
        setGuests(clearedGuests);

        // Find the first guest and make them active
        setActiveGuestId(clearedGuests[0].id);
        setCurrentStep(3);
    };

    const handleAddGuest = () => {
        const newId = `guest-${Date.now()}`;
        const newGuestNum = guests.length + 1;
        setGuests([...guests, { id: newId, name: `Guest ${newGuestNum}`, services: [], staff: null, time: null }]);
        setActiveGuestId(newId);
        setCurrentStep(1);
    };

    const handleRemoveGuest = (guestId) => {
        if (guests.length <= 1) return;
        const reindexed = guests.filter(g => g.id !== guestId).map((g, i) => ({ ...g, name: `Guest ${i + 1}` }));
        setGuests(reindexed);
        if (activeGuestId === guestId) setActiveGuestId(reindexed[0].id);
    };

    const handleContinue = () => {
        if (currentStep === 1) {
            if (activeGuest.services.length > 0) {
                const nextMissingServices = guests.find(g => g.services.length === 0);
                if (nextMissingServices) {
                    setActiveGuestId(nextMissingServices.id);
                } else {
                    // All have services, ready for Step 2 (Staff)
                    setCurrentStep(2);
                    const nextNoStaff = guests.find(g => g.staff === null) || guests[0];
                    setActiveGuestId(nextNoStaff.id);
                }
            }
        } else if (currentStep === 2) {
            if (activeGuest.staff !== null) {
                const nextNoStaff = guests.find(g => g.staff === null);
                if (nextNoStaff) {
                    setActiveGuestId(nextNoStaff.id);
                } else {
                    // All have staff, ready for Step 3 (Time)
                    setGuests(guests.map(g => (g.time && g.time.staffId !== g.staff.id) ? { ...g, time: null } : g));
                    setCurrentStep(3);
                    const nextNoTimeId = getNextGuestIdForTime(guests) || guests[0].id;
                    setActiveGuestId(nextNoTimeId);
                }
            }
        } else if (currentStep === 3) {
            if (activeGuest.time !== null) {
                const nextNoTimeId = getNextGuestIdForTime(guests);
                if (nextNoTimeId) {
                    setActiveGuestId(nextNoTimeId);
                }
            }
        }
    };

    const handleBack = () => currentStep > 1 && setCurrentStep(currentStep - 1);
    const handleChangeStaff = (id) => { setActiveGuestId(id); setCurrentStep(2); };
    const handleChangeTime = (id) => { setActiveGuestId(id); setCurrentStep(3); };
    const handleChangeService = (id) => { setActiveGuestId(id); setCurrentStep(1); };

    const handleRemoveService = (guestId, serviceId) => {
        const updatedGuests = guests.map(g => {
            if (g.id !== guestId) return g;
            // Remove the target service + always strip overtime (time resets so OT is invalid)
            const newServices = g.services.filter(s => s.id !== serviceId && !s.isOvertime);
            const hasMain = newServices.some(s => !s.isAddon);
            // If no main service remains, also clear staff so they start fresh
            return {
                ...g,
                services: newServices,
                time: null,
                staff: hasMain ? g.staff : null,
            };
        });
        setGuests(updatedGuests);

        const totalServices = updatedGuests.reduce((acc, g) => acc + g.services.length, 0);
        if (totalServices === 0) {
            setCurrentStep(1);
            setActiveGuestId(updatedGuests[0].id);
            return;
        }

        const targetGuest = updatedGuests.find(g => g.id === guestId);
        const hasMainServices = targetGuest?.services.some(s => !s.isAddon);

        if (!hasMainServices) {
            setCurrentStep(1);
            setActiveGuestId(guestId);
        } else if (currentStep === 3) {
            setActiveGuestId(guestId);
        }
    };

    const handleRemoveAll = () => {
        setGuests([{ id: 'guest-1', name: 'Guest 1', services: [], staff: null, time: null }]);
        setActiveGuestId('guest-1');
        setCurrentStep(1);
        clearCart();
        sessionStorage.clear();
    };

    // derived state memoized
    const { allSelectedServices, totalPrice } = useMemo(() => {
        const all = guests.flatMap(g => g.services);
        const price = all.reduce((sum, item) => sum + item.price, 0);
        return { allSelectedServices: all, totalPrice: price };
    }, [guests]);

    const totalDuration = "1h 30min"; // Optimized out mock logic

    const getStepTitle = React.useCallback(() => {
        if (currentStep === 1) return "Select services";
        if (currentStep === 2) return "Select professional";
        if (currentStep === 3) return "Select time";
        return "";
    }, [currentStep]);

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    {currentStep === 1 ? (
                        <Link to="/" className={styles.closeBtn}><FiX size={24} /></Link>
                    ) : (
                        <button className={styles.closeBtn} onClick={handleBack}><FiChevronLeft size={24} /></button>
                    )}
                    <span className={styles.stepTitle}>{getStepTitle()}</span>
                </div>
                <div className={styles.headerRight}>
                    <a href="tel:0493853415" className={styles.headerCallBtn}>
                        <FiPhone />
                        <span className={styles.headerCallText}>0493 853 415</span>
                    </a>
                </div>
            </div>

            <div className={styles.contentGrid}>
                <div className={styles.mainColumn}>
                    {/* GuestSelector: show in step 1 & 2 only — step 3 has its own guest tabs inside TimeSelection */}
                    {currentStep < 3 && (
                        <GuestSelector
                            guests={guests}
                            activeGuestId={activeGuestId}
                            onSwitchGuest={setActiveGuestId}
                            onAddGuest={handleAddGuest}
                            onRemoveGuest={handleRemoveGuest}
                        />
                    )}

                    {currentStep === 1 && (
                        <ServiceList
                            services={services}
                            onServiceSelect={handleServiceSelect}
                            hideSeeAll={true}
                            isLoading={servicesLoading}
                            buttonText="Add"
                            selectedIds={activeGuest.services.map(s => s.id)}
                        />
                    )}

                    {currentStep === 2 && (
                        <div style={{ padding: '0 16px' }}>
                            {visualLoading ? (
                                <div className={styles.loadingContainer}>
                                    <div className={styles.spinner}></div>
                                    <p>Checking professional's availability...</p>
                                </div>
                            ) : (
                                <StaffSelection
                                    key={activeGuestId}
                                    staffMembers={staff}
                                    onSelect={handleStaffSelect}
                                    guestName={activeGuest.name}
                                    selectedStaffId={activeGuest.staff?.id}
                                />
                            )}
                        </div>
                    )}

                    {currentStep === 3 && (
                        <TimeSelection
                            guests={guests}
                            activeGuestId={activeGuestId}
                            onGuestSwitch={setActiveGuestId}
                            onSelect={handleTimeSelect}
                            staffMembers={staff}
                        />
                    )}
                </div>

                <div className={styles.sideColumn}>
                    <CartSummary
                        guests={guests}
                        activeGuestId={activeGuestId}
                        totalPrice={totalPrice}
                        totalDuration={totalDuration}
                        onContinue={handleContinue}
                        onRemoveService={handleRemoveService}
                        onRemoveAll={handleRemoveAll}
                        currentStep={currentStep}
                        showContinue={currentStep < 3 && allSelectedServices.length > 0}
                        onChangeStaff={handleChangeStaff}
                        onChangeTime={handleChangeTime}
                        onChangeService={handleChangeService}
                        onBook={handleBook}
                        isBooking={isBooking}
                        bookingResult={bookingResult}
                        bookingErrors={bookingErrors}
                        user={user}
                    />
                </div>
            </div>

            {bookingResult === 'success' && successGuests && (
                <BookingSuccessModal
                    guests={successGuests}
                    onClose={() => setBookingResult(null)}
                />
            )}

            {bookingResult === 'error' && bookingErrors.length > 0 && (
                <BookingErrorModal
                    errors={bookingErrors}
                    onRetry={handleRetryBooking}
                />
            )}

            {showCashModal && (
                <CashOnlyModal
                    onConfirm={handleCashConfirm}
                    onCancel={() => setShowCashModal(false)}
                />
            )}

            {bookingResult === 'maintenance' && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className={styles.maintenanceCard}>
                        <div className={styles.maintenanceIconWrapper}>
                            <FiPhone size={40} />
                        </div>
                        <h1 className={styles.maintenanceTitle}>Almost there!</h1>
                        <p className={styles.maintenanceText}>
                            Our online system is temporarily paused for updates until <strong>June</strong>.
                        </p>
                        <div style={{ margin: '8px 0', textAlign: 'center' }}>
                            <p className={styles.maintenanceText}>Please call us to confirm your selected time:</p>
                        </div>
                        <a href="tel:0493853415" className={styles.maintenanceCallBtn}>
                            <FiPhone size={20} />
                            <span>Call 0493 853 415</span>
                        </a>
                        <button 
                            onClick={() => setBookingResult(null)} 
                            style={{ marginTop: '16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            Back to Booking
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingPage;
