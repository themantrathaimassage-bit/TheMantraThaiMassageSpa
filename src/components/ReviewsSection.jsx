import React, { useState, useEffect } from 'react';
import { FiStar, FiX, FiArrowRight } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import styles from './ReviewsSection.module.css';

const ReviewsSection = ({ reviews, rating, reviewCount }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedReview, setSelectedReview] = useState(null);

    // Prevent background scrolling when modal is open
    useEffect(() => {
        if (isModalOpen || selectedReview) {
            // Mobile (iOS Safari) requires locking both or fixing position
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, [isModalOpen, selectedReview]);

    const googleMapsUrl = "https://www.google.com/maps/place/The+Mantra+Thai+Massage+spa+Marrickville/@-33.9120463,151.1597879,17z/data=!3m1!4b1!4m6!3m5!1s0x6b12b111c3038151:0xb973627b6fb125ce!8m2!3d-33.9120463!4d151.1597879!16s%2Fg%2F11ynwshjt4";

    const ReviewCard = ({ review, idx, isModal = false, forceExpanded = false }) => {
        const [isExpanded, setIsExpanded] = useState(forceExpanded);
        const gradientIdx = review.user ? review.user.length % 5 : 0;
        const avatarContent = review.avatar ? (
            <img src={review.avatar} alt={review.user} className={styles.avatarImage} referrerPolicy="no-referrer" />
        ) : (
            <div className={`${styles.avatar} ${styles['avatarBg' + gradientIdx]}`}>
                {review.user ? review.user.charAt(0).toUpperCase() : 'U'}
            </div>
        );

        const MAX_LENGTH = 160;
        const commentText = review.comment || '';
        const shouldTruncate = commentText.length > MAX_LENGTH;
        const displayText = isExpanded || !shouldTruncate ? commentText : commentText.slice(0, MAX_LENGTH) + '...';

        return (
            <div key={review.id || idx} className={styles.reviewCard}>
                <div className={styles.cardHeader}>
                    {review.authorUrl ? (
                        <a href={review.authorUrl} target="_blank" rel="noopener noreferrer" className={styles.avatarWrapper}>{avatarContent}</a>
                    ) : (
                        <div className={styles.avatarWrapper}>{avatarContent}</div>
                    )}

                    <div className={styles.userInfo}>
                        {review.authorUrl ? (
                            <a href={review.authorUrl} target="_blank" rel="noopener noreferrer" className={styles.userLink}>
                                <span className={styles.user}>{review.user || 'Google User'}</span>
                            </a>
                        ) : (
                            <span className={styles.user}>{review.user || 'Google User'}</span>
                        )}

                        <div className={styles.userMeta}>
                            <span className={styles.date}>{review.date}</span>
                        </div>
                    </div>
                    <div className={styles.googleIconWrapper}>
                        <FcGoogle size={18} />
                    </div>
                </div>
                <div className={styles.rating}>
                    {[...Array(5)].map((_, i) => (
                        <FiStar
                            key={i}
                            className={styles.starIconSmall}
                            fill={i < review.rating ? "#FBBC04" : "none"}
                            stroke={i < review.rating ? "#FBBC04" : "#dadce0"}
                        />
                    ))}
                </div>
                <div className={`${styles.commentContainer} ${isModal || forceExpanded ? styles.commentExpanded : ''}`}>
                    <span className={styles.commentText}>{forceExpanded ? commentText : displayText}</span>
                    {shouldTruncate && !forceExpanded && (
                        <button
                            className={styles.seeMoreBtn}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isModal) {
                                    setIsExpanded(!isExpanded);
                                } else {
                                    setSelectedReview(review);
                                }
                            }}
                        >
                            {isModal ? (isExpanded ? 'Show less' : 'Read more') : 'Read full review'}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h2 className={styles.title}>What our clients say</h2>
                    <p className={styles.subtitle}>Real experiences from our lovely customers</p>
                </div>

                <div className={styles.headerRight}>
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className={styles.googleBadge}>
                        <FcGoogle className={styles.googleIcon} />
                        <div className={styles.badgeContent}>
                            <div className={styles.badgeScoreRow}>
                                <span className={styles.badgeRating}>{rating}</span>
                                <div className={styles.badgeStars}>
                                    {[...Array(5)].map((_, i) => (
                                        <FiStar
                                            key={i}
                                            className={styles.starIconSmall}
                                            fill={i < Math.floor(rating || 5) ? "#FBBC04" : "none"}
                                            stroke={i < Math.floor(rating || 5) ? "#FBBC04" : "#dadce0"}
                                        />
                                    ))}
                                </div>
                            </div>
                            <span className={styles.badgeCount}>Based on {reviewCount} reviews</span>
                        </div>
                    </a>
                </div>
            </div>

            <div className={styles.reviewsGrid}>
                {reviews.slice(0, 10).map((review, idx) => (
                    <ReviewCard key={review.id || idx} review={review} idx={idx} isModal={false} />
                ))}

                {reviews.length > 0 && (
                    <div className={styles.seeAllCard} onClick={() => setIsModalOpen(true)}>
                        <div className={styles.seeAllIconWrapper}>
                            <FiArrowRight size={24} />
                        </div>
                        <span className={styles.seeAllText}>See all reviews</span>
                    </div>
                )}
            </div>

            <div className={styles.sectionFooter}>
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className={styles.writeReviewBrandBtn}>
                    <FcGoogle size={20} />
                    <span>Write a review on Google</span>
                </a>
            </div>
            {/* Reviews Modal Popup */}
            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderContent}>
                                <h3>All Reviews</h3>
                                <div className={styles.modalHeaderBadge}>
                                    <FcGoogle />
                                    <span>{rating} from {reviewCount} reviews</span>
                                </div>
                            </div>
                            <button className={styles.closeButton} onClick={() => setIsModalOpen(false)}>
                                <FiX size={24} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.modalReviewsList}>
                                {reviews.map((review, idx) => (
                                    <ReviewCard key={review.id || idx} review={review} idx={idx} isModal={true} />
                                ))}
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className={styles.primaryButtonBlock}>
                                <FcGoogle size={20} /> Write a Review on Google
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Individual Review Modal Popup */}
            {selectedReview && (
                <div className={styles.modalOverlay} onClick={() => setSelectedReview(null)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderContent}>
                                <h3>Review</h3>
                            </div>
                            <button className={styles.closeButton} onClick={() => setSelectedReview(null)}>
                                <FiX size={24} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.modalReviewsList}>
                                <ReviewCard review={selectedReview} idx={0} isModal={true} forceExpanded={true} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReviewsSection;
