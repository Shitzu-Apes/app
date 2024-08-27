<script lang="ts">
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2 class="prose prose-invert prose-shitzu px-4 text-2xl">
      How Revenue Share Works
    </h2>
  </slot>
  <section class="prose prose-shitzu prose-invert p-6 pt-0">
    <h3>Referral Fees</h3>
    Share your referral link with anyone. If they use your link you will receive
    50% of the protocol fee they generated.<br /><br />
    <strong>Example:</strong><br />
    A user uses your link to visit meme.cooking and deposits 10N into a meme coin
    launch. The regular protocol fee is 0.5% for deposits. Since the user used your
    link the protocol instead earns 0.25% (0.025N) and you earn 0.25% (0.025N).

    <h3>Withdrawal Fees</h3>
    If someone decides to paper-hand a token before it even launched, 2% of their
    NEAR deposit is locked and distributed to other people who deposited NEAR to
    this token, when the launch period ends (regardless of whether it launches or
    fails).<br /><br />
    <strong>Example 1:</strong><br />
    You deposited any amount of NEAR into a meme coin launch. Another user deposited
    5N into the same meme coin launch. There are no other depositors. The other user
    decides to withdraw their full 5N before the launch period ends. The user only
    receives 4.9N (-2%/0.1N withdrawal fee). The withdrawal fee of 0.1N will be distributed
    to you at the end period, because you are the only depositor.<br /><br />
    <strong>Example 2:</strong><br />
    You deposited 10N into a meme coin launch. User A deposited 5N into the same
    meme coin launch. User B deposited 15N into the same meme coin launch. There
    are no other depositors. User B decides to withdraw their full 15N before the
    launch period ends. User B only receives 14.7N (-2%/0.3N withdrawal fee). The
    withdrawal fee of 0.3N will be distributed to you and user A at the end period.
    You receive 0.2N and user A receives 0.1N based on their deposited NEAR.
  </section>
</BottomSheetContent>
