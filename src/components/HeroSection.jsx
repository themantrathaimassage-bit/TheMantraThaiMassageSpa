import React, { useState } from 'react';
import { FiStar, FiMapPin } from 'react-icons/fi';
import { MdVerified } from 'react-icons/md';
import styles from './HeroSection.module.css';
import PhotoGalleryModal from './PhotoGalleryModal';

const HeroSection = ({ venue }) => {
    const [showGallery, setShowGallery] = useState(false);
    const [initialGalleryIndex, setInitialGalleryIndex] = useState(0);

    const openGallery = (index) => {
        setInitialGalleryIndex(index);
        setShowGallery(true);
    };

    const getCurrentStatus = () => {
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getDay()];

        const parseTime = (timeStr) => {
            const [time, modifier] = timeStr.split(/(am|pm)/);
            let [hours, minutes] = time.split(':');
            hours = parseInt(hours);
            minutes = parseInt(minutes) || 0;
            if (modifier === 'pm' && hours < 12) hours += 12;
            if (modifier === 'am' && hours === 12) hours = 0;
            return hours * 60 + minutes;
        };

        const getNextOpenText = (fromDayIndex) => {
            for (let i = 1; i <= 7; i++) {
                const nextIndex = (fromDayIndex + i) % 7;
                const nextDay = days[nextIndex];
                const nextHours = venue.openingHours.find(h => h.day === nextDay);
                if (nextHours && nextHours.hours !== 'Closed') {
                    const [openStr] = nextHours.hours.split(' - ');
                    if (i === 1) return `Opens tmr ${openStr}`;
                    return `Opens ${nextDay.slice(0, 3)} ${openStr}`;
                }
            }
            return 'Closed';
        };

        const todayHours = venue.openingHours.find(h => h.day === currentDay);

        if (!todayHours || todayHours.hours === 'Closed') {
            return { isOpen: false, text: getNextOpenText(now.getDay()) };
        }

        const [openStr, closeStr] = todayHours.hours.split(' - ');
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const openMinutes = parseTime(openStr);
        const closeMinutes = parseTime(closeStr);

        if (currentMinutes < openMinutes) {
            return { isOpen: false, text: `Opens at ${openStr}` };
        }

        if (currentMinutes >= closeMinutes) {
            return { isOpen: false, text: getNextOpenText(now.getDay()) };
        }

        return { isOpen: true, text: `Open until ${closeStr}` };
    };

    const status = getCurrentStatus();

    return (
        <section className={styles.hero}>
            <div className={styles.gallery}>
                {venue.images.map((img, index) => (
                    <div
                        key={index}
                        className={styles.galleryItem}
                        style={{ backgroundImage: `url(${img})` }}
                        onClick={() => openGallery(index)}
                    />
                ))}
            </div>

            {showGallery && (
                <PhotoGalleryModal
                    images={venue.images}
                    initialIndex={initialGalleryIndex}
                    onClose={() => setShowGallery(false)}
                />
            )}

            <div className={styles.infoContainer}>
                <div className={styles.header}>
                    <div className={styles.titleRow}>
                        <h1 className={styles.venueName}>{venue.name}</h1>
                    </div>

                    <div className={styles.metaContainer}>
                        <p className={styles.metaInfo}>
                            <span>{venue.location}</span>
                            <span className={styles.separator}>•</span>
                            <span
                                className={styles.statusText}
                                style={{ color: status.isOpen ? '#0F8C3B' : '#ef4444', cursor: 'pointer' }}
                                onClick={() => document.getElementById('opening-hours')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                            >
                                {status.text}
                            </span>
                            <span className={styles.separator}>•</span>
                            <span className={styles.verifiedBadge}>
                                <MdVerified className={styles.verifiedIcon} />
                                <span>Verified Business</span>
                            </span>
                        </p>
                    </div>



                    <div className={styles.locationRow}>
                        <FiMapPin className={styles.pinIcon} />
                        <span className={styles.address}>{venue.address}</span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HeroSection;
