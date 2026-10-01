import { getSiteImages } from "@/lib/site-settings";
import SignupForm from "@/components/auth/SignupForm";
import { getRegistrationMode } from "@/lib/registration";
import { BrandMark } from "@/components/layout/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default async function SignupPage() {
  const siteImages = await getSiteImages();
  const mode = await getRegistrationMode();
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[46%_54%]">
      <section className="relative hidden overflow-hidden bg-[#9b7e68] lg:block">
        <img
          src={siteImages.signupImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute left-10 top-9">
          <BrandMark inverse />
        </div>
      </section>
      <section className="relative flex items-center justify-center px-5 py-16">
        <div className="absolute right-6 top-5">
          <LanguageSwitcher />
        </div>
        <SignupForm mode={mode} />
      </section>
    </main>
  );
}
