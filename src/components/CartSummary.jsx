import React, { useState } from 'react';
import { FiTrash2, FiChevronUp, FiX } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './CartSummary.module.css';

const CartSummary = ({ guests, activeGuestId, totalPrice, totalDuration, onContinue, showContinue, onRemoveService, onRemoveAll, onChangeStaff, onChangeTime, onChangeService, currentStep, onBook, isBooking, bookingResult, bookingErrors, user }) => {
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const { openAuth, logout } = useAuth();
    const hasServices = guests.some(g => g.services.length > 0);
    const activeGuest = guests.find(g => g.id === activeGuestId);

    // Global missing status for messages
    const missingServices = guests.find(g => g.services.length === 0);
    const missingStaff = currentStep >= 2 && guests.find(g => g.services.length > 0 && g.staff === null);
    const missingTime = currentStep >= 3 && guests.find(g => g.services.length > 0 && g.time === null);

    // Only disable if the ACTIVE guest is the one with the problem
    const isActiveMissingServices = currentStep === 1 && (!activeGuest || activeGuest.services.length === 0);
    const isActiveMissingStaff = currentStep === 2 && (!activeGuest || activeGuest.staff === null);
    const isActiveMissingTime = currentStep === 3 && (!activeGuest || activeGuest.time === null);

    const isDisabled = isActiveMissingServices || isActiveMissingStaff || isActiveMissingTime;

    const validationMsg = (currentStep === 1 && missingServices)
        ? `Please select a service for ${missingServices.name}`
        : (currentStep === 2 && missingStaff)
            ? `Please select a professional for ${missingStaff.name}`
            : (currentStep === 3 && missingTime)
                ? `Please select a time for ${missingTime.name}`
                : null;

    const allHaveTime = currentStep === 3 && !missingTime && hasServices;

    const itemCount = guests.reduce((acc, g) => acc + g.services.length, 0);

    return (
        <>
            {/* Desktop & Mobile Overlay Container */}
            <div className={`${styles.container} ${isReviewOpen ? styles.overlayOpen : ''}`}>
                <div className={styles.overlayHeader} onClick={() => setIsReviewOpen(false)}>
                    <span className={styles.overlayTitle}>Review your booking</span>
                    <button className={styles.closeOverlayBtn}>
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
                                    <span className={styles.cartIcon}>🛍️</span>
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
                                        <ul className={styles.list}>
                                            {guest.services.map((item, index) => (
                                                <li key={`${guest.id}-${item.id}-${index}`} className={styles.item}>
                                                    <div className={styles.itemMain}>
                                                        <div className={styles.itemInfo}>
                                                            <span className={styles.itemName}>{item.name}</span>
                                                            <span className={styles.itemDuration}>{item.duration}</span>
                                                        </div>
                                                        <div className={styles.itemAction}>
                                                            <span className={styles.itemPrice}>${item.price}</span>
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
                                    </div>
                                )
                            ))}
                        </div>
                        <div className={styles.totalRow}>
                            <span>Total due</span>
                            <span>${totalPrice}</span>
                        </div>
                    </div>
                )}

                <div className={styles.footer}>
                    {hasServices && validationMsg && (
                        <div className={styles.validationMessage}>
                            {validationMsg}
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
                        <>
                            {user ? (
                                <div className={styles.bookingAs}>
                                    <div className={styles.bookingAsMain}>
                                        <span className={styles.bookingAsIcon}>👤</span>
                                        <span>Booking as <strong>{user.firstName || user.email}</strong></span>
                                    </div>
                                    <button onClick={logout} className={styles.logoutInlineBtn}>Logout</button>
                                </div>
                            ) : (
                                <div className={styles.loginPrompt}>
                                    <p>Sign in to complete your booking</p>
                                    <p className={styles.loginSubtext}>Quick book. No passwords.</p>
                                    <button onClick={() => openAuth({ returnTo: '/booking' })} className={styles.loginLinkButton}>
                                        Sign in / Create account →
                                    </button>
                                </div>
                            )}
                            <button
                                className={styles.bookBtn}
                                onClick={onBook}
                                disabled={isBooking}
                                style={{ opacity: isBooking ? 0.7 : 1 }}
                            >
                                {isBooking ? <span className={styles.bookingSpinner}>Booking…</span> : '✓ Make booking'}
                            </button>
                        </>
                    )}
                    {bookingResult === 'success' && (
                        <div className={styles.bookingSuccess}>
                            <span className={styles.bookingSuccessIcon}>✅</span>
                            <strong>Success!</strong>
                            <p>Your appointment has been created.</p>
                            <Link to="/" className={styles.returnHomeBtn}>Return to home</Link>
                        </div>
                    )}
                    {bookingResult === 'error' && bookingErrors.length > 0 && (
                        <div className={styles.bookingError}>
                            <strong>⚠️ Booking failed</strong>
                            {bookingErrors.map((e, i) => <p key={i}>{e}</p>)}
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Floating Bar */}
            {hasServices && !isReviewOpen && bookingResult !== 'success' && (
                <div className={`${styles.floatingBar} ${isDisabled ? styles.floatingBarDisabled : ''}`}>
                    {isDisabled && validationMsg ? (
                        <div className={styles.floatingValidation}>
                            <span className={styles.validationText}>{validationMsg}</span>
                        </div>
                    ) : (
                        <div className={styles.floatingInfo} onClick={() => setIsReviewOpen(true)}>
                            <div className={styles.floatingText}>
                                <span className={styles.floatingTitle}>Your Booking</span>
                                <span className={styles.floatingDetails}>
                                    {itemCount} {itemCount === 1 ? 'item' : 'items'} • <strong>${totalPrice}</strong>
                                </span>
                            </div>
                            <FiChevronUp className={styles.floatingChevron} />
                        </div>
                    )}

                    {showContinue && (
                        <button
                            className={`${styles.floatingContinueBtn} ${isDisabled ? styles.floatingDisabledBtn : ''}`}
                            onClick={() => {
                                if (!isDisabled) onContinue();
                            }}
                        >
                            Continue
                        </button>
                    )}
                    {allHaveTime && (
                        <button
                            className={styles.floatingBookBtn}
                            onClick={onBook}
                            disabled={isBooking}
                        >
                            {isBooking ? '...' : 'Book'}
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
