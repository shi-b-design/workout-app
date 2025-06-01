import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Supabase client with the service role key
// This allows bypassing RLS for server-side operations like updating user roles
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use the service role key
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (!signature || !webhookSecret) {
      return new NextResponse('Stripe signature or webhook secret missing', { status: 400 });
    }
    // Read the request body as text first for signature verification
    const reqBody = await req.text();
    event = stripe.webhooks.constructEvent(reqBody, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed. ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.CheckoutSession;

      // Extract user ID from client_reference_id
      const userId = session.client_reference_id;

      if (userId) {
        console.log(`Checkout session completed for user: ${userId}`);
        try {
          // Update user's plan in the public.users table using the service role key
          const { error } = await supabaseAdmin
            .from('users')
            .update({ plan: 'premium' })
            .eq('id', userId);

          if (error) {
            console.error('Error updating user plan in DB:', error);
            return new NextResponse('Database update failed', { status: 500 });
          }
          console.log(`User ${userId} plan updated to premium.`);

        } catch (dbError) {
           console.error('Error updating user plan in DB:', dbError);
           return new NextResponse('Database update failed', { status: 500 });
        }
      } else {
         console.error('User ID not found in checkout session.');
         return new NextResponse('User ID not found', { status: 400 });
      }
      break;
    // Handle other event types if needed
    // case 'customer.subscription.updated':
    // case 'customer.subscription.deleted':
    //   ...
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return new NextResponse('Received', { status: 200 });
} 