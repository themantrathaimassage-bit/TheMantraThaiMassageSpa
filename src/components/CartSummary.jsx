import React, { useState, useEffect } from 'react';
import { FiTrash2, FiChevronUp, FiX, FiCalendar } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './CartSummary.module.css';

const CartSummary = ({ guests, activeGuestId, totalPrice, totalDuration, onContinue, showContinue, onRemoveService, onRemoveAll, onChangeStaff, onChangeTime, onChangeService, currentStep, onBook, isBooking, bookingResult, bookingErrors, user }) => {
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const { openAuth, logout } = useAuth();
    const hasServices = guests.some(g => g.services.length > 0);
    const activeGuest = guests.find(g => g.id === activeGuestId);

    // Listen for booking success to close the mobile overlay
    // Listen for booking success to close the mobile overlay
    useEffect(() => {
        const handleClose = () => setIsReviewOpen(false);
        window.addEventListener('closeMobileOverlay', handleClose);
        return () => window.removeEventListener('closeMobileOverlay', handleClose);
    }, []);

    // Swipe down to close state for the overlay only
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = React.useRef(null);
    const overlayRef = React.useRef(null);
    const animationRef = React.useRef(null);

    const handleOverlayTouchStart = (e) => {
        dragStartY.current = e.touches[0].clientY;
        setIsDragging(true);
    };

    const handleOverlayTouchMove = (e) => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const delta = currentY - dragStartY.current;

        if (delta > 0) { // Only allow dragging downwards
            // Use requestAnimationFrame for smooth 60fps dragging without React state lag
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            animationRef.current = requestAnimationFrame(() => {
                if (overlayRef.current) {
                    overlayRef.current.style.transform = `translateY(${delta}px)`;
                    overlayRef.current.style.transition = 'none';
                }
            });
            // Still track it in ref for the end calculation, but don't cause re-renders during drag
            dragStartY.lastDelta = delta;
        }
    };

    const handleOverlayTouchEnd = () => {
        setIsDragging(false);
        const finalDelta = dragStartY.lastDelta || 0;

        // Requires a really deep, deliberate swipe down (~350px) to close the modal
        if (finalDelta > 350) {
            setIsReviewOpen(false);
        } else {
            // Snap back
            if (overlayRef.current) {
                overlayRef.current.style.transform = '';
                overlayRef.current.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            }
        }

        dragStartY.lastDelta = 0;
        setDragY(0);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };

    // Swipe UP on floating bar to open
    const barTouchStartY = React.useRef(null);
    const handleBarTouchStart = (e) => {
        barTouchStartY.current = e.touches[0].clientY;
    };

    const handleBarTouchEnd = (e) => {
        if (!barTouchStartY.current) return;
        const currentY = e.changedTouches[0].clientY;
        const delta = barTouchStartY.current - currentY; // positive delta means swiped UP

        // If swiped up more than 20px, open the review modal
        if (delta > 20) {
            setIsReviewOpen(true);
        }
        barTouchStartY.current = null;
    };

    // Prevent background scrolling when mobile overlay is open
    useEffect(() => {
        if (isReviewOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isReviewOpen]);

    // Helper to clean up service names that include duration in parentheses
    const formatServiceName = (name) => {
        if (!name) return "";
        // Removes patterns like (30 mins), (1hr), etc.
        return name.replace(/\s*\([\d\s\w]+\)\s*/gi, '').trim();
    };

    // 1. Check for missing global status
    const missingServices = guests.find(g => g.services.length === 0);
    const missingMainService = guests.find(g => g.services.length > 0 && g.services.every(s => s.isAddon));
    const missingStaff = currentStep >= 2 && guests.find(g => g.services.length > 0 && g.staff === null);
    const missingTime = currentStep >= 3 && guests.find(g => g.services.length > 0 && g.time === null);

    // 2. Active guest specific checks (Only disable button if the CURRENT guest has a problem)
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
        // Only apply React state transforms when not actively dragging to avoid lag
        transform: (!isDragging && isReviewOpen) ? '' : undefined,
        transition: !isDragging ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        touchAction: 'pan-y' // Prevent browser pull-to-refresh interfering ideally
    };

    return (
        <>
            {/* Desktop & Mobile Overlay Container */}
            <div
                ref={overlayRef}
                className={`${styles.container} ${isReviewOpen ? styles.overlayOpen : ''}`}
                style={overlayStyle}
            >
                <div
                    className={styles.overlayHeader}
                    onTouchStart={handleOverlayTouchStart}
                    onTouchMove={handleOverlayTouchMove}
                    onTouchEnd={handleOverlayTouchEnd}
                    onClick={() => setIsReviewOpen(false)}
                >
                    <span className={styles.overlayTitle}>Review your booking</span>
                    <button className={styles.closeOverlayBtn} onClick={() => setIsReviewOpen(false)}>
                        <FiX size={20} />
                    </button>
                </div>

                {!hasServices ? (
                    <div className={styles.emptyState}>
                        <p>No services selected yet</p>
                    </div>
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
                            <button className={styles.removeAllBtn} onClick={onRemoveAll}>
                                Remove all
                            </button>
                        </div>

                        <div className={styles.scrollArea}>
                            {guests.map((guest) => (
                                guest.services.length > 0 && (
                                    <div key={guest.id} className={styles.guestGroup}>
                                        <div className={styles.guestName}>
                                            <span>{guest.name}</span>
                                            {guest.staff && (
                                                <button
                                                    className={styles.guestStaff}
                                                    onClick={() => { onChangeStaff && onChangeStaff(guest.id); setIsReviewOpen(false); }}
                                                    title="Change professional"
                                                >
                                                    {guest.staff.id === 'any' ? 'Any available' : `with ${guest.staff.name}`} ✎
                                                </button>
                                            )}
                                            {guest.time && (
                                                <button
                                                    className={styles.guestTime}
                                                    onClick={() => { onChangeTime && onChangeTime(guest.id); setIsReviewOpen(false); }}
                                                    title="Change time"
                                                >
                                                    🕐 {guest.time.time} ✎
                                                </button>
                                            )}
                                        </div>
                                        <div className={styles.servicesContainer}>
                                            <ul className={styles.list}>
                                                {guest.services.filter(s => !s.isAddon).map((item, index) => (
                                                    <li
                                                        key={`${guest.id}-main-${item.id}-${index}`}
                                                        className={styles.item}
                                                    >
                                                        <div className={styles.itemMain}>
                                                            <div className={styles.itemInfo}>
                                                                <span className={styles.itemName} title={item.name}>
                                                                    {formatServiceName(item.name)}
                                                                </span>
                                                                <div className={styles.itemMeta}>
                                                                    <span className={styles.itemDuration}>{item.duration}</span>
                                                                    <span className={styles.itemDot}>•</span>
                                                                    <span className={styles.itemPrice}>${item.price}</span>
                                                                </div>
                                                            </div>
                                                            <div className={styles.itemAction}>
                                                                <button
                                                                    className={styles.removeSingleBtn}
                                                                    onClick={() => onRemoveService(guest.id, item.id)}
                                                                    aria-label="Remove service"
                                                                >
                                                                    <FiTrash2 size={16} />
                                                                </button>
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
                                                            <li
                                                                key={`${guest.id}-addon-${item.id}-${index}`}
                                                                className={`${styles.item} ${item.isOvertime ? styles.itemOvertime : styles.itemAddonSeparated}`}
                                                            >
                                                                <div className={styles.itemMain}>
                                                                    <div className={styles.itemInfo}>
                                                                        <span className={styles.itemName} title={item.name}>
                                                                            {item.isOvertime ? '🌙 ' : ''}{formatServiceName(item.name)}
                                                                        </span>
                                                                        <div className={styles.itemMeta}>
                                                                            <span className={styles.itemDuration}>{item.duration}</span>
                                                                            <span className={styles.itemDot}>•</span>
                                                                            <span className={styles.itemPrice}>${item.price}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className={styles.itemAction}>
                                                                        {item.isOvertime ? (
                                                                            <span className={styles.overtimeLockIcon} title="Auto-calculated overtime charge">🔒</span>
                                                                        ) : (
                                                                            <button
                                                                                className={styles.removeSingleBtn}
                                                                                onClick={() => onRemoveService(guest.id, item.id)}
                                                                                aria-label="Remove service"
                                                                            >
                                                                                <FiTrash2 size={16} />
                                                                            </button>
                                                                        )}
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
                    {hasServices && (
                        <div className={styles.totalRow}>
                            <span>Total due</span>
                            <span>${totalPrice}</span>
                        </div>
                    )}
                    {hasServices && showContinue && (
                        <div className={styles.buttonWrapper}>
                            {isDisabled && validationMsg && (
                                <div className={styles.inlineValidation}>
                                    {validationMsg}
                                </div>
                            )}
                            <button
                                className={`${styles.continueBtn} ${isDisabled ? styles.disabledBtn : ''}`}
                                onClick={() => {
                                    if (!isDisabled) {
                                        onContinue();
                                        setIsReviewOpen(false);
                                    }
                                }}
                                disabled={false} // Make it clickable to show error or just styled disabled
                                style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                            >
                                Continue
                            </button>
                        </div>
                    )}
                    {hasServices && allHaveTime && bookingResult !== 'success' && (
                        <div className={styles.reviewFooter}>
                            {user ? (
                                <div className={styles.compactUserRow}>
                                    <div className={styles.userMinimalInfo}>
                                        <span className={styles.userInitial}>
                                            {(user.firstName || user.email || 'U')[0].toUpperCase()}
                                        </span>
                                        <div className={styles.userText}>
                                            <span className={styles.userGreet}>Booking as</span>
                                            <span className={styles.userNameText}>{user.firstName || user.email.split('@')[0]}</span>
                                        </div>
                                    </div>
                                    <button onClick={onBook} disabled={isBooking} className={styles.compactBookBtn}>
                                        {isBooking ? '...' : 'Complete Booking'}
                                    </button>
                                </div>
                            ) : (
                                <div className={styles.loginCardCompact}>
                                    <div className={styles.loginTextSide}>
                                        <strong>Sign in</strong>
                                        <span>to complete booking</span>
                                    </div>
                                    <button onClick={() => openAuth({ returnTo: '/booking' })} className={styles.compactLoginBtn}>
                                        Sign in →
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Floating Bar */}
            {hasServices && !isReviewOpen && bookingResult !== 'success' && (
                <div
                    className={`${styles.floatingBar} ${isDisabled ? styles.floatingBarDisabled : ''}`}
                    onClick={() => setIsReviewOpen(true)}
                    onTouchStart={handleBarTouchStart}
                    onTouchEnd={handleBarTouchEnd}
                >
                    {isDisabled && validationMsg ? (
                        <div className={styles.floatingValidation}>
                            <div className={styles.pullUpIndicator}>
                                <FiChevronUp className={`${styles.pullUpIcon} ${styles.pullUpIconError}`} />
                                <FiChevronUp className={`${styles.pullUpIcon} ${styles.pullUpIconError}`} />
                                <FiChevronUp className={`${styles.pullUpIcon} ${styles.pullUpIconError}`} />
                            </div>
                            <span className={styles.validationText}>{validationMsg}</span>
                        </div>
                    ) : (
                        <div className={styles.floatingInfo}>
                            <div className={styles.pullUpIndicator}>
                                <FiChevronUp className={styles.pullUpIcon} />
                                <FiChevronUp className={styles.pullUpIcon} />
                                <FiChevronUp className={styles.pullUpIcon} />
                            </div>
                            <div className={styles.floatingText}>
                                <span className={styles.floatingTitle}>Your Booking</span>
                                <span className={styles.floatingDetails}>
                                    {itemCount} {itemCount === 1 ? 'item' : 'items'} • <strong>${totalPrice}</strong>
                                </span>
                            </div>
                        </div>
                    )}

                    {showContinue && (
                        <button
                            className={`${styles.floatingContinueBtn} ${isDisabled ? styles.floatingDisabledBtn : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isDisabled) onContinue();
                            }}
                        >
                            Continue
                        </button>
                    )}
                    {allHaveTime && (
                        <button
                            className={styles.floatingBookBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                onBook();
                            }}
                            disabled={isBooking}
                        >
                            {isBooking ? '...' : (user ? `Book as ${user.firstName || (user.email ? user.email.split('@')[0] : 'Guest')}` : 'Log in / Sign up')}
                        </button>
                    )}
                </div>
            )}

            {/* Backdrop for Mobile Overlay */}
            {isReviewOpen && (
                <div className={styles.backdrop} onClick={() => setIsReviewOpen(false)} />
            )}
        </>
    );
};

export default CartSummary;
