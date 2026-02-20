import React from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './CartSummary.module.css';

const CartSummary = ({ guests, activeGuestId, totalDuration, totalPrice, onContinue, showContinue, onRemoveService, onRemoveAll, onChangeStaff, onChangeTime, currentStep, onBook, isBooking, bookingResult, bookingErrors, user }) => {
    const { openAuth, logout } = useAuth();
    const hasServices = guests.some(g => g.services.length > 0);
    const missingServices = guests.find(g => g.services.length === 0);

    // In Step 2, we only disable if the ACTIVE guest hasn't selected staff.
    // This allows clicking "Continue" to move to the next guest or step.
    const activeGuest = guests.find(g => g.id === activeGuestId);
    const missingStaffForActive = currentStep === 2 && (!activeGuest || activeGuest.staff === null);

    const allHaveTime = currentStep === 3 && guests.every(g => g.services.length === 0 || g.time !== null);

    // In Step 1, we still need everyone to have services before moving to step 2.
    const isDisabled = currentStep === 1 ? !!missingServices : missingStaffForActive;

    const validationMsg = (currentStep === 1 && missingServices)
        ? `Please select a service for ${missingServices.name}`
        : (currentStep === 2 && missingStaffForActive)
            ? `Please select a professional for ${activeGuest?.name}`
            : null;

    return (
        <div className={styles.container}>
            {!hasServices ? (
                <div className={styles.emptyState}>
                    <p>No services selected yet</p>
                </div>
            ) : (
                <div className={styles.cartContent}>
                    <div className={styles.cartHeader}>
                        <span className={styles.cartTitle}>Selected services</span>
                        <button className={styles.removeAllBtn} onClick={onRemoveAll}>
                            Remove all
                        </button>
                    </div>

                    {guests.map((guest) => (
                        guest.services.length > 0 && (
                            <div key={guest.id} className={styles.guestGroup}>
                                <div className={styles.guestName}>
                                    <span>{guest.name}</span>
                                    {guest.staff && (
                                        <button
                                            className={styles.guestStaff}
                                            onClick={() => onChangeStaff && onChangeStaff(guest.id)}
                                            title="Change professional"
                                        >
                                            {guest.staff.id === 'any' ? 'Any available' : `with ${guest.staff.name}`} ✎
                                        </button>
                                    )}
                                    {guest.time && (
                                        <span className={styles.guestTime}>
                                            🕐 {guest.time.time} · {guest.time.date.dayName} {guest.time.date.dayNum} {guest.time.date.month}
                                        </span>
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
                    <div className={styles.totalRow}>
                        <span>Total</span>
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
                    <button
                        className={styles.continueBtn}
                        onClick={onContinue}
                        disabled={isDisabled}
                        style={{ opacity: isDisabled ? 0.5 : 1 }}
                    >
                        Continue
                    </button>
                )}
                {hasServices && allHaveTime && bookingResult !== 'success' && (
                    <>
                        {user ? (
                            <div className={styles.bookingAs}>
                                <div className={styles.bookingAsMain}>
                                    <span className={styles.bookingAsIcon}>👤</span>
                                    <span>Booking as <strong>{user.firstName || user.email}</strong></span>
                                </div>
                                <button onClick={logout} className={styles.logoutInlineBtn} title="Change person / Logout">
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <div className={styles.loginPrompt}>
                                <p>Sign in to complete your booking</p>
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
                            {isBooking ? (
                                <span className={styles.bookingSpinner}>Booking…</span>
                            ) : (
                                '✓ Make booking'
                            )}
                        </button>
                    </>
                )}
                {bookingResult === 'success' && (
                    <div className={styles.bookingSuccess}>
                        <span className={styles.bookingSuccessIcon}>✅</span>
                        <strong>Success!</strong>
                        <p>Your appointment has been created. You can manage your booking from the message sent to your phone.</p>
                        <Link to="/" className={styles.returnHomeBtn}>Return to home</Link>
                    </div>
                )}
                {bookingResult === 'error' && bookingErrors.length > 0 && (
                    <div className={styles.bookingError}>
                        <strong>⚠️ Booking failed</strong>
                        {bookingErrors.map((e, i) => (
                            <p key={i}>{e}</p>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CartSummary;
