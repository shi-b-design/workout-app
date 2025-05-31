import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(req: Request) {
  if (req.method !== 'POST') {
    return new NextResponse('Method Not Allowed', { status: 405 });
  }

  try {
    // Get the user ID from the request (you'll need to send this from the frontend)
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return new NextResponse('User ID is required', { status: 400 });
    }

    // Create a Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.PREMIUM_PRICE_ID, // Use your Premium Price ID from environment variables
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/upgrade-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/dashboard`, // Redirect back to dashboard on cancel
      // Optional: Pass user ID to Stripe to associate the subscription with the user
      client_reference_id: userId,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout Session creation failed:', error);
    return new NextResponse('Error creating checkout session', { status: 500 });
  }
} 