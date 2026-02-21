import React, { useState, useEffect, useCallback, memo } from 'react';
import HeroSection from '../components/HeroSection';
import { venueData } from '../data/venueData';
import ServiceList from '../components/ServiceList';
import { servicesData } from '../data/servicesData';
import { fetchSquareServices } from '../data/squareCatalog';
import AboutSection from '../components/AboutSection';
import ReviewsSection from '../components/ReviewsSection';
import { reviewsData } from '../data/reviewsData';
import StickyBookingCard from '../components/StickyBookingCard';
import styles from './VenuePage.module.css';

import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const VenuePage = () => {
    const [venue, setVenue] = useState(venueData);
    const [services, setServices] = useState(servicesData);
    const [servicesLoading, setServicesLoading] = useState(true);
    const [reviews, setReviews] = useState(reviewsData);

    const { addService, selectedServices } = useCart();
    const navigate = useNavigate();

    // Data Fetching with AbortController for cleanup
    useEffect(() => {
        const controller = new AbortController();
        setServicesLoading(true);

        // Fetch Services
        fetchSquareServices().then(live => {
            if (!controller.signal.aborted && live?.length > 0) setServices(live);
            setServicesLoading(false);
        }).catch(() => {
            if (!controller.signal.aborted) setServicesLoading(false);
        });

        // Fetch Location Info
        import('../data/squareCatalog').then(m => m.fetchSquareLocation()).then(liveLoc => {
            if (!controller.signal.aborted && liveLoc) {
                setVenue(prev => ({
                    ...prev,
                    ...liveLoc,
                    // Preserve rating/reviewCount if already fetched from reviews
                    rating: prev.rating,
                    reviewCount: prev.reviewCount
                }));
            }
        });

        // Fetch Reviews
        fetch('/api/reviews', { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
                if (controller.signal.aborted) return;

                const list = Array.isArray(data) ? data : (data?.reviews || []);
                if (list.length > 0) setReviews(list);

                if (data?.rating) {
                    setVenue(prev => ({
                        ...prev,
                        rating: data.rating,
                        reviewCount: data.user_ratings_total
                    }));
                }
            })
            .catch(err => {
                if (err.name !== 'AbortError') console.error('Fetch reviews error:', err);
            });

        return () => controller.abort();
    }, []);

    const handleServiceSelect = useCallback((service) => {
        addService(service);
        navigate('/booking');
    }, [addService, navigate]);

    return (
        <div className={styles.pageContainer}>
            <HeroSection venue={venue} />

            <div className={styles.contentGrid}>
                <main className={styles.mainContent}>
                    <section className={styles.sectionWrapper}>
                        <div id="services" style={{ scrollMarginTop: '140px' }}>
                            <ServiceList
                                services={services}
                                onServiceSelect={handleServiceSelect}
                                isSearching={false}
                                isLoading={servicesLoading}
                                buttonText="Book"
                                selectedIds={selectedServices.map(s => s.id)}
                            />
                        </div>
                    </section>

                    <hr className={styles.divider} />

                    <section className={styles.sectionWrapper}>
                        <div id="location" style={{ scrollMarginTop: '140px' }}>
                            <AboutSection venue={venue} />
                        </div>
                    </section>

                    <hr className={styles.divider} />

                    <section className={styles.sectionWrapper}>
                        <div id="reviews" style={{ scrollMarginTop: '140px' }}>
                            <ReviewsSection
                                reviews={reviews}
                                rating={venue.rating}
                                reviewCount={venue.reviewCount}
                            />
                        </div>
                    </section>
                </main>

                <aside className={styles.sidebar}>
                    <StickyBookingCard venue={venue} />
                </aside>
            </div>
        </div>
    );
};

export default memo(VenuePage);
