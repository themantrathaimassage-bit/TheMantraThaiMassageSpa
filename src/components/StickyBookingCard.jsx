import React from 'react';
import { Link } from 'react-router-dom';
import styles from './StickyBookingCard.module.css';

const StickyBookingCard = ({ venue }) => {
    const getCurrentStatus = () => {
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getDay()];

        const todayHours = venue.openingHours.find(h => h.day === currentDay);

        if (!todayHours || todayHours.hours === 'Closed') {
            return { isOpen: false, text: 'Closed' };
        }

        const [openStr, closeStr] = todayHours.hours.split(' - ');

        const parseTime = (timeStr) => {
            const [time, modifier] = timeStr.split(/(am|pm)/);
            let [hours, minutes] = time.split(':');
            hours = parseInt(hours);
            minutes = parseInt(minutes);

            if (modifier === 'pm' && hours < 12) hours += 12;
            if (modifier === 'am' && hours === 12) hours = 0;

            return hours * 60 + minutes;
        };

        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const openMinutes = parseTime(openStr);
        const closeMinutes = parseTime(closeStr);

        if (currentMinutes < openMinutes) {
            return { isOpen: false, text: `Closed - opens at ${openStr}` };
        }

        if (currentMinutes >= closeMinutes) {
            return { isOpen: false, text: 'Closed' };
        }

        return { isOpen: true, text: `Open until ${closeStr}` };
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
                                {item.hours}
                            </span>
                        </li>
                    ))}
                </ul>

                <div className={styles.location}>
                    <p className={styles.addressText}>{venue.address}</p>
                    <a href="#" className={styles.directionsLink}>Get directions</a>
                </div>
            </div>
        </div>
    );
};

export default StickyBookingCard;
