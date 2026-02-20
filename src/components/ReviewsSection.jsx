import React from 'react';
import { FiStar } from 'react-icons/fi';
import styles from './ReviewsSection.module.css';

const ReviewsSection = ({ reviews, rating, reviewCount }) => {
    const googleMapsUrl = "https://www.google.com/maps/place/The+Mantra+Thai+Massage+spa+Marrickville/@-33.9120463,151.1597879,17z/data=!3m1!4b1!4m6!3m5!1s0x6b12b111c3038151:0xb973627b6fb125ce!8m2!3d-33.9120463!4d151.1597879!16s%2Fg%2F11ynwshjt4";

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Reviews</h2>
                <div className={styles.summary}>
                    <div className={styles.overallRating}>{rating}</div>
                    <div className={styles.stars}>
                        {[...Array(5)].map((_, i) => (
                            <FiStar
                                key={i}
                                className={styles.starIcon}
                                fill={i < Math.floor(rating) ? "currentColor" : "none"}
                                stroke="currentColor"
                            />
                        ))}
                    </div>
                    <div className={styles.count}>{reviewCount} reviews on Google</div>
                </div>
                <div className={styles.updateInfo}>
                    <span>Updated hourly</span>
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className={styles.googleLink}>
                        View on Google Maps
                    </a>
                </div>
            </div>

            <div className={styles.list}>
                {reviews.map((review) => (
                    <div key={review.id} className={styles.review}>
                        <div className={styles.reviewHeader}>
                            <span className={styles.user}>{review.user}</span>
                            <span className={styles.date}>{review.date}</span>
                        </div>
                        <div className={styles.rating}>
                            {[...Array(5)].map((_, i) => (
                                <FiStar
                                    key={i}
                                    className={styles.starIconSmall}
                                    fill={i < review.rating ? "currentColor" : "none"}
                                    stroke="currentColor"
                                />
                            ))}
                        </div>
                        <p className={styles.comment}>{review.comment}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReviewsSection;
