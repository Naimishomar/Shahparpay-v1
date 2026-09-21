import { MacbookScroll } from "@/components/ui/macbook-scroll";

export default function MacbookScrollDemo() {
  return (
    // overflow-x-clip, not overflow-hidden: `hidden` on either axis makes this a
    // scroll container, and useScroll inside MacbookScroll then binds to it
    // instead of the page, freezing the lid permanently shut.
    <div className="w-full overflow-x-clip bg-white">
      <MacbookScroll
        title={
          <span>
            One dashboard for every service you offer. <br /> Open it on any
            computer at your counter.
          </span>
        }
        // Placeholder. Swap public/retailer-dashboard.svg for a real screenshot
        // of the dashboard; the screen crops 4:3 from the top left.
        src="/retailer-dashboard.svg"
        showGradient={false}
      />
    </div>
  );
}
