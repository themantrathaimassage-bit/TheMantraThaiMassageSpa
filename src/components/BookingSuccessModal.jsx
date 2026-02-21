import React, { useEffect } from 'react';
import { FiCheckCircle, FiCalendar, FiClock, FiUser, FiHome, FiCheck } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import styles from './BookingSuccessModal.module.css';

const BookingSuccessModal = ({ guests, onClose }) => {
    const navigate = useNavigate();

    // Prevent scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const handleReturnHome = () => {
        onClose();
        navigate('/');
    };

    const formatDate = (dateObj) => {
        if (!dateObj || !dateObj.date) return '';
        return new Date(dateObj.date).toLocaleDateString('en-AU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div className={styles.successIconWrapper}>
                        <FiCheckCircle className={styles.successIcon} />
                    </div>
                    <h2 className={styles.title}>Booking Confirmed!</h2>
                    <p className={styles.subtitle}>We've received your appointment request.</p>
                </div>

                <div className={styles.content}>
                    <div className={styles.summaryList}>
                        {guests.map((guest, idx) => (
                            guest.services.length > 0 && (
                                <div key={guest.id} className={styles.guestItem}>
                                    <div className={styles.guestHeader}>
                                        <FiUser className={styles.icon} />
                                        <span>{guest.name}</span>
                                    </div>
                                    <div className={styles.serviceBox}>
                                        {guest.services.map((s, sIdx) => (
                                            <div key={sIdx} className={styles.serviceName}>
                                                {s.name.replace(/\s*\([\d\s\w]+\)\s*/gi, '').trim()}
                                            </div>
                                        ))}
                                        <div className={styles.dateTimeLine}>
                                            <div className={styles.metaItem}>
                                                <FiCalendar size={12} />
                                                <span>{formatDate(guest.time?.date)}</span>
                                            </div>
                                            <div className={styles.metaItem}>
                                                <FiClock size={12} />
                                                <span>{guest.time?.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.homeBtn} onClick={handleReturnHome}>
                        <FiHome size={18} />
                        Return to Home
                    </button>
                    <p className={styles.thankYou}>Thank you for choosing us!</p>
                </div>
            </div>
        </div>
    );
};

export default BookingSuccessModal;
