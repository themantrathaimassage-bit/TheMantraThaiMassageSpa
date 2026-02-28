import React from 'react';
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import styles from './PhotoGalleryModal.module.css';

const PhotoGalleryModal = ({ images, onClose, initialIndex = 0 }) => {
    const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

    const handlePrev = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    };

    const handleNext = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    };

    React.useEffect(() => {
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') handlePrev(e);
            if (e.key === 'ArrowRight') handleNext(e);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [onClose]);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <button className={styles.closeBtn} onClick={onClose}>
                <FiX />
            </button>

            <div className={styles.content} onClick={(e) => e.stopPropagation()}>
                <div className={styles.imageContainer}>
                    <img
                        src={images[currentIndex]}
                        alt={`Photo ${currentIndex + 1}`}
                        className={styles.image}
                    />
                </div>

                <button className={`${styles.navBtn} ${styles.prevBtn}`} onClick={handlePrev}>
                    <FiChevronLeft />
                </button>
                <button className={`${styles.navBtn} ${styles.nextBtn}`} onClick={handleNext}>
                    <FiChevronRight />
                </button>

                <div className={styles.counter}>
                    {currentIndex + 1} / {images.length}
                </div>
            </div>

            <div className={styles.thumbnails}>
                {images.map((img, idx) => (
                    <div
                        key={idx}
                        className={`${styles.thumbnail} ${currentIndex === idx ? styles.active : ''}`}
                        onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                    >
                        <img src={img} alt={`Thumbnail ${idx + 1}`} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PhotoGalleryModal;
