import React, { useState, useEffect } from 'react';
import { FiTrash2, FiChevronUp, FiX, FiCalendar } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import styles from './CartSummary.module.css';

const CartSummary = ({ guests, activeGuestId, totalPrice, totalDuration, onContinue, showContinue, onRemoveService, onRemoveAll, onChangeStaff, onChangeTime, onChangeService, currentStep, onBook, isBooking, bookingResult, bookingErrors, user }) => {
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const hasServices = guests.some(g => g.services.length > 0);
    const activeGuest = guests.find(g => g.id === activeGuestId);

    // Listen for booking success to close the mobile overlay
    useEffect(() => {
        const handleClose = () => setIsReviewOpen(false);
        window.addEventListener('closeMobileOverlay', handleClose);
        return () => window.removeEventListener('closeMobileOverlay', handleClose);
    }, []);

    // Swipe down to close logic for mobile
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = React.useRef(null);
    const overlayRef = React.useRef(null);
    const floatingBarRef = React.useRef(null);
    const animationRef = React.useRef(null);

    const handleOverlayTouchStart = (e) => {
        dragStartY.current = e.touches[0].clientY;
        setIsDragging(true);
    };

    const handleOverlayTouchMove = (e) => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const delta = currentY - dragStartY.current;
        if (delta > 0) {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            animationRef.current = requestAnimationFrame(() => {
                if (overlayRef.current) {
                    overlayRef.current.style.transform = `translateY(${delta}px)`;
                    overlayRef.current.style.transition = 'none';
                }
            });
            dragStartY.lastDelta = delta;
        }
    };

    const handleOverlayTouchEnd = () => {
        setIsDragging(false);
        const finalDelta = dragStartY.lastDelta || 0;
        if (finalDelta > 200) {
            setIsReviewOpen(false);
        } else {
            if (overlayRef.current) {
                overlayRef.current.style.transform = '';
                overlayRef.current.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            }
        }
        dragStartY.lastDelta = 0;
        setDragY(0);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };

    const barTouchStartY = React.useRef(null);
    const handleBarTouchStart = (e) => { barTouchStartY.current = e.touches[0].clientY; };
    const handleBarTouchEnd = (e) => {
        if (!barTouchStartY.current) return;
        const currentY = e.changedTouches[0].clientY;
        const delta = barTouchStartY.current - currentY;
        if (delta > 20) setIsReviewOpen(true);
        barTouchStartY.current = null;
    };

    useEffect(() => {
        const bar = floatingBarRef.current;
        if (!bar) return;
        const preventBarScroll = (e) => e.preventDefault();
        bar.addEventListener('touchmove', preventBarScroll, { passive: false });
        return () => bar.removeEventListener('touchmove', preventBarScroll);
    }, [hasServices, isReviewOpen, bookingResult]);

    useEffect(() => {
        const preventScroll = (e) => {
            if (overlayRef.current && overlayRef.current.contains(e.target)) return;
            e.preventDefault();
        };
        if (isReviewOpen) {
            const scrollY = window.scrollY;
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.documentElement.style.overflow = 'hidden';
            document.addEventListener('touchmove', preventScroll, { passive: false });
        } else {
            const scrollY = document.body.style.top;
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.documentElement.style.overflow = '';
            document.removeEventListener('touchmove', preventScroll);
            if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.documentElement.style.overflow = '';
            document.removeEventListener('touchmove', preventScroll);
        };
    }, [isReviewOpen]);

    const formatServiceName = (name) => {
        if (!name) return "";
        return name.replace(/\s*\([\d\s\w]+\)\s*/gi, '').trim();
    };

    const missingServices = guests.find(g => g.services.length === 0);
    const missingMainService = guests.find(g => g.services.length > 0 && g.services.every(s => s.isAddon));
    const missingStaff = currentStep >= 2 && guests.find(g => g.services.length > 0 && g.staff === null);
    const missingTime = currentStep >= 3 && guests.find(g => g.services.length > 0 && g.time === null);

    const isActiveMissingServices = currentStep === 1 && (!activeGuest || activeGuest.services.length === 0);
    const isActiveOnlyAddons = currentStep === 1 && activeGuest && activeGuest.services.length > 0 && activeGuest.services.every(s => s.isAddon);
    const isActiveMissingStaff = currentStep === 2 && (!activeGuest || activeGuest.staff === null);
    const isActiveMissingTime = currentStep === 3 && (!activeGuest || activeGuest.time === null);

    const isDisabled = isActiveMissingServices || isActiveOnlyAddons || isActiveMissingStaff || isActiveMissingTime;

    const validationMsg = (currentStep === 1 && missingServices)
        ? `Please select a service for ${missingServices.name}`
        : (currentStep === 1 && missingMainService)
            ? `Please select a main service for ${missingMainService.name} (Add-ons cannot be booked alone)`
            : (currentStep === 2 && missingStaff)
                ? `Please select a professional for ${missingStaff.name}`
                : (currentStep === 3 && missingTime)
                    ? `Please select a time for ${missingTime.name}`
                    : null;

    const allHaveTime = currentStep === 3 && !missingTime && hasServices;
    const itemCount = guests.reduce((acc, g) => acc + g.services.length, 0);

    const overlayStyle = {
        transform: (!isDragging && isReviewOpen) ? '' : undefined,
        transition: !isDragging ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        touchAction: 'pan-y'
    };

    return (
        <>
            <div ref={overlayRef} className={`${styles.container} ${isReviewOpen ? styles.overlayOpen : ''}`} style={overlayStyle}>
                <div className={styles.overlayHeader} onTouchStart={handleOverlayTouchStart} onTouchMove={handleOverlayTouchMove} onTouchEnd={handleOverlayTouchEnd} onClick={() => setIsReviewOpen(false)}>
                    <span className={styles.overlayTitle}>Review your booking</span>
                    <button className={styles.closeOverlayBtn} onClick={() => setIsReviewOpen(false)}><FiX size={20} /></button>
                </div>

                {!hasServices ? (
                    <div className={styles.emptyState}><p>No services selected yet</p></div>
                ) : (
                    <div className={styles.cartContent}>
                        <div className={styles.cartHeader}>
                            <div className={styles.cartTitleWrapper}>
                                <div className={styles.cartIconWrapper}>
                                    <FiCalendar className={styles.cartIcon} size={22} />
                                    <span className={styles.badge}>{itemCount}</span>
                                </div>
                                <span className={styles.cartTitle}>Your Booking</span>
                            </div>
                            <button className={styles.removeAllBtn} onClick={onRemoveAll}>Remove all</button>
                        </div>

                        <div className={styles.scrollArea}>
                            {guests.map((guest) => (
                                guest.services.length > 0 && (
                                    <div key={guest.id} className={styles.guestGroup}>
                                        <div className={styles.guestName}>
                                            <span>{guest.name}</span>
                                            {guest.staff && (
                                                <button className={styles.guestStaff} onClick={() => { onChangeStaff && onChangeStaff(guest.id); setIsReviewOpen(false); }}>
                                                    {guest.staff.id === 'any' ? 'Any available' : `with ${guest.staff.name}`} ✎
                                                </button>
                                            )}
                                            {guest.time && (
                                                <button className={styles.guestTime} onClick={() => { onChangeTime && onChangeTime(guest.id); setIsReviewOpen(false); }}>
                                                    🕐 {guest.time.time} ✎
                                                </button>
                                            )}
                                        </div>
                                        <div className={styles.servicesContainer}>
                                            <ul className={styles.list}>
                                                {guest.services.filter(s => !s.isAddon).map((item, index) => (
                                                    <li key={`${guest.id}-main-${item.id}-${index}`} className={styles.item}>
                                                        <div className={styles.itemMain}>
                                                            <div className={styles.itemInfo}>
                                                                <span className={styles.itemName} title={item.name}>{formatServiceName(item.name)}</span>
                                                                <div className={styles.itemMeta}>
                                                                    <span className={styles.itemDuration}>{item.duration}</span>
                                                                    <span className={styles.itemDot}>•</span>
                                                                    <span className={styles.itemPrice}>${item.price}</span>
                                                                </div>
                                                            </div>
                                                            <div className={styles.itemAction}>
                                                                <button className={styles.removeSingleBtn} onClick={() => onRemoveService(guest.id, item.id)} aria-label="Remove service"><FiTrash2 size={16} /></button>
                                                            </div>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                            {guest.services.some(s => s.isAddon) && (
                                                <div className={styles.addonGroup}>
                                                    <div className={styles.addonGroupLabel}>{guest.name} Add-ons</div>
                                                    <ul className={styles.list}>
                                                        {guest.services.filter(s => s.isAddon).map((item, index) => (
                                                            <li key={`${guest.id}-addon-${item.id}-${index}`} className={`${styles.item} ${item.isOvertime ? styles.itemOvertime : styles.itemAddonSeparated}`}>
                                                                <div className={styles.itemMain}>
                                                                    <div className={styles.itemInfo}>
                                                                        <span className={styles.itemName} title={item.name}>{item.isOvertime ? '🌙 ' : ''}{formatServiceName(item.name)}</span>
                                                                        <div className={styles.itemMeta}>
                                                                            <span className={styles.itemDuration}>{item.duration}</span>
                                                                            <span className={styles.itemDot}>•</span>
                                                                            <span className={styles.itemPrice}>${item.price}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className={styles.itemAction}>
                                                                        {item.isOvertime ? <span className={styles.overtimeLockIcon}>🔒</span> : <button className={styles.removeSingleBtn} onClick={() => onRemoveService(guest.id, item.id)} aria-label="Remove service"><FiTrash2 size={16} /></button>}
                                                                    </div>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                )}

                <div className={styles.footer}>
                    {hasServices && <div className={styles.totalRow}><span>Total due</span><span>${totalPrice}</span></div>}
                    {hasServices && showContinue && (
                        <div className={styles.buttonWrapper}>
                            {isDisabled && validationMsg && <div className={styles.inlineValidation}>{validationMsg}</div>}
                            <button className={`${styles.continueBtn} ${isDisabled ? styles.disabledBtn : ''}`} onClick={() => { if (!isDisabled) { onContinue(); setIsReviewOpen(false); } }} style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}>Continue</button>
                        </div>
                    )}
                    {hasServices && allHaveTime && bookingResult !== 'success' && (
                        <div className={styles.reviewFooter}>
                            <button onClick={onBook} disabled={isBooking} className={styles.compactBookBtn} style={{ width: '100%', height: '48px', fontSize: '16px' }}>
                                {isBooking ? 'Completing Booking...' : 'Process Order & Complete'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {hasServices && !isReviewOpen && bookingResult !== 'success' && (
                <div ref={floatingBarRef} className={`${styles.floatingBar} ${isDisabled ? styles.floatingBarDisabled : ''}`} onClick={() => setIsReviewOpen(true)} onTouchStart={handleBarTouchStart} onTouchEnd={handleBarTouchEnd}>
                    {isDisabled && validationMsg ? (
                        <div className={styles.floatingValidation}>
                            <div className={styles.pullUpIndicator}><FiChevronUp className={`${styles.pullUpIcon} ${styles.pullUpIconError}`} /><FiChevronUp className={`${styles.pullUpIcon} ${styles.pullUpIconError}`} /><FiChevronUp className={`${styles.pullUpIcon} ${styles.pullUpIconError}`} /></div>
                            <span className={styles.validationText}>{validationMsg}</span>
                        </div>
                    ) : (
                        <div className={styles.floatingInfo}>
                            <div className={styles.pullUpIndicator}><FiChevronUp className={styles.pullUpIcon} /><FiChevronUp className={styles.pullUpIcon} /><FiChevronUp className={styles.pullUpIcon} /></div>
                            <div className={styles.floatingText}><span className={styles.floatingTitle}>Your Booking</span><span className={styles.floatingDetails}>{itemCount} items • <strong>${totalPrice}</strong></span></div>
                        </div>
                    )}
                    {showContinue && <button className={`${styles.floatingContinueBtn} ${isDisabled ? styles.floatingDisabledBtn : ''}`} onClick={(e) => { e.stopPropagation(); if (!isDisabled) onContinue(); }}>Continue</button>}
                    {allHaveTime && <button className={styles.floatingBookBtn} onClick={(e) => { e.stopPropagation(); onBook(); }} disabled={isBooking}>{isBooking ? '...' : 'Complete Booking'}</button>}
                </div>
            )}
            {isReviewOpen && <div className={styles.backdrop} onClick={() => setIsReviewOpen(false)} />}
        </>
    );
};

export default CartSummary;
