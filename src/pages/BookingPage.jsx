import React, { useState, useEffect, useMemo } from 'react';
import { FiX, FiChevronLeft, FiPhone } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import ServiceList from '../components/ServiceList';
import StaffSelection from '../components/StaffSelection';
import TimeSelection from '../components/TimeSelection';
import CartSummary from '../components/CartSummary';
import GuestSelector from '../components/GuestSelector';
import { fetchSquareServices, createSquareBookings } from '../data/squareCatalog';
import { staffData } from '../data/staffData';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import styles from './BookingPage.module.css';

const BookingPage = () => {
    const { selectedServices, clearCart } = useCart();
    const { user, openAuth } = useAuth();
    // Restore step from sessionStorage so back-navigation doesn't reset it
    const [currentStep, setCurrentStep] = useState(() => {
        try { return parseInt(sessionStorage.getItem('bk_step') || '1', 10); } catch { return 1; }
    });
    const [services, setServices] = useState([]);
    const [servicesLoading, setServicesLoading] = useState(true);
    const [isBooking, setIsBooking] = useState(false);
    const [bookingResult, setBookingResult] = useState(null); // null | 'success' | 'error'
    const [bookingErrors, setBookingErrors] = useState([]);

    // Fetch live catalog from Square on mount
    useEffect(() => {
        fetchSquareServices().then(liveServices => {
            if (liveServices && liveServices.length > 0) {
                setServices(liveServices);
            }
            setServicesLoading(false);
        });
    }, []);

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
        const existingIndex = activeGuest.services.findIndex(s => s.baseServiceName === service.baseServiceName);
        if (existingIndex > -1) {
            const newServices = [...activeGuest.services];
            newServices[existingIndex] = service;
            updateGuest(activeGuestId, { services: newServices });
        } else {
            updateGuest(activeGuestId, { services: [...activeGuest.services, service] });
        }
    }, [activeGuest, activeGuestId, updateGuest]);

    const handleStaffSelect = React.useCallback((staff) => {
        updateGuest(activeGuestId, { staff });
    }, [activeGuestId, updateGuest]);

    const handleTimeSelect = React.useCallback((guestId, date, time, availability) => {
        const staffId = guests.find(g => g.id === guestId)?.staff?.id;
        const updatedGuests = guests.map(g => g.id === guestId ? { ...g, time: { date, time, availability, staffId } } : g);
        setGuests(updatedGuests);

        const allHaveTime = updatedGuests.every(g => g.time !== null);
        if (!allHaveTime) {
            const currentIndex = updatedGuests.findIndex(g => g.id === guestId);
            const nextGuest = updatedGuests.slice(currentIndex + 1).find(g => g.time === null)
                || updatedGuests.find(g => g.time === null);
            if (nextGuest) setActiveGuestId(nextGuest.id);
        } else {
            setTimeout(() => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }, 100);
        }
    }, [guests]);

    const handleBook = async () => {
        if (!user) {
            openAuth({ returnTo: '/booking' });
            return;
        }
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
                setBookingResult('success');
                clearCart();
                setGuests([{ id: 'guest-1', name: 'Guest 1', services: [], staff: null, time: null }]);
                sessionStorage.removeItem('bk_guests');
                sessionStorage.removeItem('bk_step');
                sessionStorage.removeItem('bk_activeGuest');
            }
        } catch (err) {
            setBookingErrors([err.message]);
            setBookingResult('error');
        } finally {
            setIsBooking(false);
        }
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
        if (currentStep === 1 && activeGuest.services.length > 0) {
            const next = guests.find(g => g.services.length === 0);
            if (next) setActiveGuestId(next.id);
            else { setCurrentStep(2); setActiveGuestId(guests[0].id); }
        } else if (currentStep === 2) {
            if (guests.every(g => g.staff !== null)) {
                setGuests(guests.map(g => (g.time && g.time.staffId !== g.staff.id) ? { ...g, time: null } : g));
                setCurrentStep(3);
                setActiveGuestId(guests[0].id);
            } else {
                const missing = guests.find(g => g.staff === null);
                if (missing) setActiveGuestId(missing.id);
            }
        }
    };

    const handleBack = () => currentStep > 1 && setCurrentStep(currentStep - 1);
    const handleChangeStaff = (id) => { setActiveGuestId(id); setCurrentStep(2); };
    const handleChangeTime = (id) => { setActiveGuestId(id); setCurrentStep(3); };
    const handleChangeService = (id) => { setActiveGuestId(id); setCurrentStep(1); };

    const handleRemoveService = (guestId, serviceId) => {
        setGuests(guests.map(g => g.id === guestId ? { ...g, services: g.services.filter(s => s.id !== serviceId) } : g));
        setActiveGuestId(guestId);
        setCurrentStep(1);
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
                            <StaffSelection
                                key={activeGuestId}
                                staffMembers={staffData}
                                onSelect={handleStaffSelect}
                                guestName={activeGuest.name}
                                selectedStaffId={activeGuest.staff?.id}
                            />
                        </div>
                    )}

                    {currentStep === 3 && (
                        <TimeSelection
                            guests={guests}
                            activeGuestId={activeGuestId}
                            onGuestSwitch={setActiveGuestId}
                            onSelect={handleTimeSelect}
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
        </div>
    );
};

export default BookingPage;
