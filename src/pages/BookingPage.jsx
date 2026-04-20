import React, { useState, useEffect, useMemo } from 'react';
import { FiX, FiChevronLeft, FiPhone, FiUser } from 'react-icons/fi';
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
import { useUser } from '../context/UserContext';
import styles from './BookingPage.module.css';

import { staffData } from '../data/staffData';

const BookingPage = () => {
    const { selectedServices, clearCart } = useCart();
    const { user, saveUser } = useUser();
    
    const [currentStep, setCurrentStep] = useState(() => {
        try { return parseInt(sessionStorage.getItem('bk_step') || '1', 10); } catch { return 1; }
    });
    const [services, setServices] = useState([]);
    const [staff, setStaff] = useState(staffData);
    const [servicesLoading, setServicesLoading] = useState(true);
    const [isBooking, setIsBooking] = useState(false);
    const [bookingResult, setBookingResult] = useState(null);
    const [bookingErrors, setBookingErrors] = useState([]);
    const [successGuests, setSuccessGuests] = useState(null);
    const [showCashModal, setShowCashModal] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState(null);

    const [guestInfo, setGuestInfo] = useState(() => {
        if (user) return { name: user.name || '', phone: user.phone || '', email: user.email || '' };
        return { name: '', phone: '', email: '' };
    });

    useEffect(() => {
        fetchSquareServices().then(liveServices => {
            if (liveServices && liveServices.length > 0) setServices(liveServices);
            setServicesLoading(false);
        });
        import('../data/squareCatalog').then(m => m.fetchSquareTeamMembers()).then(team => {
            if (team && team.length > 0) {
                const uniqueTeam = team.map(m => ({ id: m.id, name: m.name || 'Professional', image: m.image || null }));
                setStaff([{ id: 'any', name: 'Any professional', image: null }, ...uniqueTeam]);
            } else { setStaff(staffData); }
        }).catch(() => setStaff(staffData));
    }, []);

    const [visualLoading, setVisualLoading] = useState(false);
    useEffect(() => {
        if (currentStep === 2) {
            setVisualLoading(true);
            const timer = setTimeout(() => setVisualLoading(false), 600);
            return () => clearTimeout(timer);
        }
    }, [currentStep]);

    const [guests, setGuests] = useState(() => {
        try {
            const saved = sessionStorage.getItem('bk_guests');
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.map(g => ({
                    ...g,
                    time: g.time ? {
                        ...g.time,
                        date: g.time.date ? { ...g.time.date, date: g.time.date.date ? new Date(g.time.date.date) : null } : null,
                    } : null,
                }));
            }
        } catch { }
        return [{ id: 'guest-1', name: 'Guest 1', services: selectedServices, staff: null, time: null }];
    });
    const [activeGuestId, setActiveGuestId] = useState(() => {
        try { return sessionStorage.getItem('bk_activeGuest') || 'guest-1'; } catch { return 'guest-1'; }
    });

    useEffect(() => { try { sessionStorage.setItem('bk_guests', JSON.stringify(guests)); } catch { } }, [guests]);
    useEffect(() => { try { sessionStorage.setItem('bk_step', String(currentStep)); } catch { } }, [currentStep]);
    useEffect(() => { try { sessionStorage.setItem('bk_activeGuest', activeGuestId); } catch { } }, [activeGuestId]);

    useEffect(() => {
        if (selectedServices.length > 0) {
            setGuests(prev => {
                const guest1 = prev[0];
                const existingIds = new Set(guest1.services.map(s => s.id));
                const newServices = selectedServices.filter(s => !existingIds.has(s.id));
                if (newServices.length > 0) return prev.map((g, i) => i === 0 ? { ...g, services: [...g.services, ...newServices] } : g);
                return prev;
            });
            setCurrentStep(1); clearCart();
        }
    }, [selectedServices]);

    const activeGuest = useMemo(() => guests.find(g => g.id === activeGuestId) || guests[0], [guests, activeGuestId]);
    const updateGuest = React.useCallback((guestId, updates) => { setGuests(prev => prev.map(g => g.id === guestId ? { ...g, ...updates } : g)); }, []);

    const handleServiceSelect = React.useCallback((service) => {
        if (service.isAddon) {
            const alreadySelected = activeGuest.services.find(s => s.id === service.id);
            if (alreadySelected) { updateGuest(activeGuestId, { services: activeGuest.services.filter(s => s.id !== service.id), time: null }); return; }
        }
        const existingIndex = activeGuest.services.findIndex(s => s.baseServiceName === service.baseServiceName);
        if (existingIndex > -1) { const ns = [...activeGuest.services]; ns[existingIndex] = service; updateGuest(activeGuestId, { services: ns, time: null }); }
        else { updateGuest(activeGuestId, { services: [...activeGuest.services, service], time: null }); }
    }, [activeGuest, activeGuestId, updateGuest]);

    const handleStaffSelect = (staff) => updateGuest(activeGuestId, { staff });

    const handleTimeSelect = React.useCallback((guestId, date, time, availability) => {
        setGuests(prev => {
            const guest = prev.find(g => g.id === guestId);
            if (!guest) return prev;
            const durationMs = (guest.services || []).filter(s => s.durationMs > 0).reduce((sum, s) => sum + s.durationMs, 0);
            const durationMins = Math.ceil(durationMs / 60000);
            const [h, m] = time.split(':').map(Number);
            const otMins = Math.max(0, (h*60+m + durationMins) - (21*60));
            const otVar = getOvertimeVariation(Math.ceil(otMins/15)*5, otMins);
            const newServices = otVar ? [...guest.services.filter(s => !s.isOvertime), otVar] : guest.services.filter(s => !s.isOvertime);
            const updatedGuests = prev.map(g => g.id === guestId ? { ...guest, services: newServices, time: { date, time, availability, staffId: guest.staff?.id } } : g);
            const nextGuest = updatedGuests.find(g => g.time === null);
            if (nextGuest) setActiveGuestId(nextGuest.id);
            else setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
            return updatedGuests;
        });
    }, []);

    const handleBook = async () => {
        if (!guestInfo.name || !guestInfo.phone) { alert("Please provide your name and phone number."); return; }
        if (!turnstileToken) { alert("Please complete the bot check."); return; }
        if (guests.some(g => g.services.some(s => s.name?.toLowerCase().includes('cash only')))) { setShowCashModal(true); return; }
        await executeBooking();
    };

    const executeBooking = async () => {
        setIsBooking(true); setBookingResult(null); setBookingErrors([]);
        try {
            saveUser({ firstName: guestInfo.name.split(' ')[0], ...guestInfo });
            const results = await createSquareBookings(guests, null, guestInfo, turnstileToken);
            const errors = results.filter(r => r.error);
            if (errors.length > 0) { setBookingErrors(errors.map(e => `${e.guest}: ${e.error}`)); setBookingResult('error'); }
            else { setSuccessGuests([...guests]); setBookingResult('success'); clearCart(); setGuests([{ id: 'guest-1', name: 'Guest 1', services: [], staff: null, time: null }]); sessionStorage.clear(); }
        } catch (err) { setBookingErrors([err.message]); setBookingResult('error'); } finally { setIsBooking(false); }
    };

    const handleContinue = () => {
        if (currentStep === 1 && activeGuest.services.length > 0) {
            const nm = guests.find(g => g.services.length === 0);
            if (nm) setActiveGuestId(nm.id);
            else { setCurrentStep(2); setActiveGuestId((guests.find(g => g.staff === null) || guests[0]).id); }
        } else if (currentStep === 2 && activeGuest.staff !== null) {
            const nm = guests.find(g => g.staff === null);
            if (nm) setActiveGuestId(nm.id);
            else { setCurrentStep(3); setActiveGuestId((guests.find(g => g.time === null) || guests[0]).id); }
        }
    };

    const handleRemoveService = (guestId, serviceId) => {
        const ug = guests.map(g => g.id === guestId ? { ...g, services: g.services.filter(s => s.id !== serviceId && !s.isOvertime), time: null, staff: g.services.filter(s => s.id !== serviceId && !s.isAddon).length > 0 ? g.staff : null } : g);
        setGuests(ug);
        if (ug.reduce((acc, g) => acc + g.services.length, 0) === 0) { setCurrentStep(1); setActiveGuestId(ug[0].id); return; }
        if (!ug.find(g => g.id === guestId).services.some(s => !s.isAddon)) { setCurrentStep(1); setActiveGuestId(guestId); }
    };

    useEffect(() => {
        if (currentStep === 3) {
            const script = document.createElement('script');
            script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
            script.async = true; script.defer = true;
            document.head.appendChild(script);
            window.onloadTurnstileCallback = () => { if (window.turnstile) { window.turnstile.render('#turnstile-container', { sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAAfLpYv-XQeX9G4Y', callback: (t) => setTurnstileToken(t) }); } };
            return () => { document.head.removeChild(script); delete window.onloadTurnstileCallback; };
        }
    }, [currentStep]);

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>{currentStep === 1 ? <Link to="/" className={styles.closeBtn}><FiX size={24} /></Link> : <button className={styles.closeBtn} onClick={() => setCurrentStep(currentStep-1)}><FiChevronLeft size={24} /></button>}<span className={styles.stepTitle}>{currentStep === 1 ? "Select services" : currentStep === 2 ? "Select professional" : "Booking details"}</span></div>
                <div className={styles.headerRight}><a href="tel:0493853415" className={styles.headerCallBtn}><FiPhone /><span className={styles.headerCallText}>0493 853 415</span></a></div>
            </div>
            <div className={styles.contentGrid}>
                <div className={styles.mainColumn}>
                    {currentStep < 3 && <GuestSelector guests={guests} activeGuestId={activeGuestId} onSwitchGuest={setActiveGuestId} onAddGuest={() => { setGuests([...guests, { id: `g-${Date.now()}`, name: `Guest ${guests.length+1}`, services: [], staff: null, time: null }]); setCurrentStep(1); }} onRemoveGuest={(id) => { if (guests.length > 1) { const re = guests.filter(g => g.id !== id).map((g, i) => ({ ...g, name: `Guest ${i+1}` })); setGuests(re); if (activeGuestId === id) setActiveGuestId(re[0].id); } }} />}
                    {currentStep === 1 && <ServiceList services={services} onServiceSelect={handleServiceSelect} hideSeeAll isLoading={servicesLoading} buttonText="Add" selectedIds={activeGuest.services.map(s => s.id)} />}
                    {currentStep === 2 && (visualLoading ? <div className={styles.loadingContainer}><div className={styles.spinner}></div><p>Checking availability...</p></div> : <StaffSelection key={activeGuestId} staffMembers={staff} onSelect={handleStaffSelect} guestName={activeGuest.name} selectedStaffId={activeGuest.staff?.id} />)}
                    {currentStep === 3 && (
                        <div className={styles.finalDetails}>
                            <TimeSelection guests={guests} activeGuestId={activeGuestId} onGuestSwitch={setActiveGuestId} onSelect={handleTimeSelect} staffMembers={staff} />
                            <div className={styles.contactFormSection}>
                                <h3 className={styles.sectionTitle}><FiUser style={{ marginRight: '8px' }} /> Contact Details</h3>
                                <div className={styles.formGrid}>
                                    <div className={styles.formGroup}><label>Full Name *</label><input type="text" value={guestInfo.name} onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })} /></div>
                                    <div className={styles.formGroup}><label>Phone Number *</label><input type="tel" value={guestInfo.phone} onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })} /></div>
                                    <div className={styles.formGroup}><label>Email (Optional)</label><input type="email" value={guestInfo.email} onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })} /></div>
                                </div>
                                <div id="turnstile-container" style={{ marginTop: '20px' }}></div>
                            </div>
                        </div>
                    )}
                </div>
                <div className={styles.sideColumn}><CartSummary guests={guests} activeGuestId={activeGuestId} totalPrice={guests.flatMap(g => g.services).reduce((s, i) => s + i.price, 0)} currentStep={currentStep} onContinue={handleContinue} onBook={handleBook} isBooking={isBooking} onRemoveService={handleRemoveService} onRemoveAll={() => { setGuests([{ id: 'guest-1', name: 'Guest 1', services: [], staff: null, time: null }]); setCurrentStep(1); clearCart(); sessionStorage.clear(); }} onChangeStaff={(id) => { setActiveGuestId(id); setCurrentStep(2); }} onChangeTime={(id) => { setActiveGuestId(id); setCurrentStep(3); }} onChangeService={(id) => { setActiveGuestId(id); setCurrentStep(1); }} bookingResult={bookingResult} bookingErrors={bookingErrors} user={guestInfo} /></div>
            </div>
            {bookingResult === 'success' && successGuests && <BookingSuccessModal guests={successGuests} onClose={() => setBookingResult(null)} />}
            {bookingResult === 'error' && bookingErrors.length > 0 && <BookingErrorModal errors={bookingErrors} onRetry={() => { setBookingResult(null); setGuests(guests.map(g => ({ ...g, time: null }))); setActiveGuestId(guests[0].id); setCurrentStep(3); }} />}
            {showCashModal && <CashOnlyModal onConfirm={() => { setShowCashModal(false); executeBooking(); }} onCancel={() => setShowCashModal(false)} />}
        </div>
    );
};

export default BookingPage;
