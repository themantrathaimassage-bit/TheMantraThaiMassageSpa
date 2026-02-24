import React, { useEffect } from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import styles from './BookingErrorModal.module.css';

const BookingErrorModal = ({ errors, onRetry }) => {
    // Prevent scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div className={styles.errorIconWrapper}>
                        <FiAlertTriangle className={styles.errorIcon} />
                    </div>
                    <h2 className={styles.title}>Booking Failed</h2>
                    <p className={styles.subtitle}>No bookings were made for anyone in your group.</p>
                </div>

                <div className={styles.content}>
                    <div className={styles.errorList}>
                        {errors.map((errorMsg, idx) => {
                            const [guestName, ...reasonParts] = errorMsg.split(': ');
                            const reason = reasonParts.join(': ');
                            return (
                                <div key={idx} className={styles.errorItem}>
                                    <span className={styles.guestName}>{guestName}</span>
                                    <span className={styles.guestError}>{reason}</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className={styles.explanation}>
                        To ensure everyone gets a slot, please re-select available times.
                    </p>
                </div>

                <div className={styles.footer}>
                    <button className={styles.retryBtn} onClick={onRetry}>
                        <FiRefreshCw size={18} />
                        Select new times
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookingErrorModal;
