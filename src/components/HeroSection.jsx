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
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const openMinutes = 10 * 60; // 10:00 AM
        const closeMinutes = 21 * 60; // 9:00 PM

        if (currentMinutes < openMinutes) {
            return { isOpen: false, text: 'Opens at 10:00am' };
        }

        if (currentMinutes >= closeMinutes) {
            return { isOpen: false, text: 'Opens tmr 10:00am' };
        }

        return { isOpen: true, text: 'Open until 9:00pm' };
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
