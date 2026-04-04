import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

export default function BillingSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md w-full text-center">
        <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-7 h-7 text-green-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">You're upgraded!</h1>
        <p className="text-gray-500 text-sm mb-6">
          Your plan has been updated. Your new query limit is active immediately.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-[#0f6e56] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#0a5441] transition"
        >
          Back to dashboard <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
