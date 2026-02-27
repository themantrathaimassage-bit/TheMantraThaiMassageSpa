import React, { useEffect } from 'react';
import { FiCheckCircle, FiCalendar, FiClock, FiUser, FiHome } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import styles from './BookingSuccessModal.module.css';

const BookingSuccessModal = ({ guests, onClose }) => {
    const navigate = useNavigate();

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, []);

    const handleReturnHome = () => { onClose(); navigate('/'); };

    const formatDate = (dateObj) => {
        if (!dateObj || !dateObj.date) return '';
        return new Date(dateObj.date).toLocaleDateString('en-AU', {
            weekday: 'short', day: 'numeric', month: 'short'
        });
    };

    // Calculate end time from start time + total bookable duration (durationMs > 0 only)
    const calcEndTime = (guest) => {
        if (!guest.time?.time) return null;
        const [h, m] = guest.time.time.split(':').map(Number);
        const startMins = h * 60 + m;
        const durationMins = (guest.services || [])
            .filter(s => s.durationMs > 0)
            .reduce((sum, s) => sum + Math.round(s.durationMs / 60000), 0);
        if (!durationMins) return null;
        const endMins = startMins + durationMins;
        const eh = String(Math.floor(endMins / 60)).padStart(2, '0');
        const em = String(endMins % 60).padStart(2, '0');
        return `${eh}:${em}`;
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
                        {guests.map((guest) => (
                            guest.services.length > 0 && (
                                <div key={guest.id} className={styles.guestItem}>
                                    <div className={styles.guestHeader}>
                                        <div className={styles.guestInfoCompact}>
                                            <FiUser className={styles.icon} />
                                            <span>{guest.name}</span>
                                            {guest.staff && (
                                                <span className={styles.staffBadge}>
                                                    with {guest.staff.id === 'any' ? 'Any Available' : guest.staff.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className={styles.serviceBox}>
                                        {guest.services.map((s, sIdx) => (
                                            <div
                                                key={sIdx}
                                                className={`${styles.serviceRow} ${s.isOvertime ? styles.serviceRowOT : ''}`}
                                            >
                                                <div className={styles.serviceNameColumn}>
                                                    <span className={styles.serviceName}>
                                                        {s.isOvertime ? '🌙 ' : ''}
                                                        {s.name.replace(/\s*\([\d\s\w]+\)\s*/gi, '').trim()}
                                                    </span>
                                                    <span className={styles.serviceSub}>{s.duration}</span>
                                                </div>
                                                <span className={styles.servicePrice}>${s.price}</span>
                                            </div>
                                        ))}

                                        <div className={styles.dateTimeLine}>
                                            <div className={styles.metaItem}>
                                                <FiCalendar size={12} />
                                                <span>{formatDate(guest.time?.date)}</span>
                                            </div>
                                            <div className={styles.metaItem}>
                                                <FiClock size={12} />
                                                <span>
                                                    {guest.time?.time}
                                                    {calcEndTime(guest) && (
                                                        <> → <strong>{calcEndTime(guest)}</strong></>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        ))}
                    </div>

                    <div className={styles.totalSummary}>
                        <div className={styles.totalRow}>
                            <span>Total Amount Paid</span>
                            <span className={styles.totalValue}>
                                ${guests.reduce((acc, g) => acc + g.services.reduce((sAcc, s) => sAcc + s.price, 0), 0)}
                            </span>
                        </div>
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
