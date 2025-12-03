import Image from 'next/image';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Image src="/SRCB.png" alt="SRCB Logo" width={72} height={72} />
          <h1 className="text-3xl font-bold">About SRCB</h1>
        </div>

        <section className="mt-8 bg-gray-20 border rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-3">Our History</h2>
          <p className="text-gray-700 mb-4">
            SRCB started as a small family-run guesthouse with a single set of rooms and a commitment to warm,
            personalized service. Over the years, SRCB grew thanks to loyal guests and a reputation for hospitality.
            We expanded our rooms, added event and catering services, and modernized our reservation and management systems
            while keeping the friendly service that made us loved by the community.
          </p>

          <p className="text-gray-700 mb-4">
            Today, SRCB blends classic hospitality with modern convenience. Our team continues SRCB's legacy of
            welcoming guests with heart — whether they visit for business, leisure, or a special event.
          </p>

          <p className="text-gray-700">
            If you&apos;d like to learn more about our story or book an event, please use the Reservation link in the header or
            contact our administrator from the Sign in page.
          </p>
        </section>
      </div>
    </main>
  );
}
