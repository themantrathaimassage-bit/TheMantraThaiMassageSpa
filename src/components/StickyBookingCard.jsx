import React from 'react';
import { Link } from 'react-router-dom';
import styles from './StickyBookingCard.module.css';

const StickyBookingCard = ({ venue }) => {
    const getCurrentStatus = () => {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const openMinutes = 9 * 60; // 9:00 AM
        const closeMinutes = 21 * 60; // 9:00 PM

        if (currentMinutes < openMinutes) {
            return { isOpen: false, text: 'Closed - opens at 9:00am' };
        }

        if (currentMinutes >= closeMinutes) {
            return { isOpen: false, text: 'Closed' };
        }

        return { isOpen: true, text: 'Open until 9:00pm' };
    };

    const status = getCurrentStatus();
    const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    return (
        <div className={styles.card}>
            <div className={styles.content}>
                <h3 className={styles.name}>{venue.name}</h3>
                <p className={styles.noReviews}>Massage & Spa</p>

                <div className={styles.actions}>
                    <Link to="/booking" className={styles.bookBtn}>
                        Book now
                    </Link>
                </div>

                <div className={styles.status}>
                    <div className={styles.statusHeader}>
                        <div className={status.isOpen ? styles.open : styles.closed}>
                            <span>{status.isOpen ? 'Open' : 'Closed'}</span>
                            <span className={styles.opensAtDetail}>
                                {status.isOpen ? ` ${status.text.replace('Open ', '')}` : (status.text === 'Closed' ? '' : ` - ${status.text.split(' - ')[1]}`)}
                            </span>
                        </div>
                    </div>
                </div>

                <ul className={styles.hoursList}>
                    {venue.openingHours.map((item, index) => (
                        <li key={index} className={`${styles.hourItem} ${item.day === currentDayName ? styles.currentDay : ''}`}>
                            <span className={`${styles.day} ${item.day === currentDayName ? styles.bold : ''}`}>{item.day}</span>
                            <span className={`${styles.time} ${item.day === currentDayName ? styles.bold : ''}`}>
                                9:00am - 9:00pm
                            </span>
                        </li>
                    ))}
                </ul>

                <div className={styles.location}>
                    <p className={styles.addressText}>{venue.address}</p>
                    <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venue.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.directionsLink}
                    >
                        Get directions
                    </a>
                </div>
            </div>
        </div>
    );
};

export default StickyBookingCard;
