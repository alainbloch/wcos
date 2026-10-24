import { PublicPageController } from "./publicPageController.js";
import { memberService } from "../services/memberService.js";
import { memberRosterService } from "../services/memberRosterService.js";
import { memberProfileService } from "../services/memberProfileService.js";
import { renderView } from "../utils/viewEngine.js";

export class WhoWeAreController extends PublicPageController {
  async memberProfiles(request, reply) {
    return this.renderPage(request, reply, "member-profiles", async (page) => {
      const managed = await memberService.isRosterManaged();
      const members = managed
        ? Object.values(await memberService.getMembersGroupedByLevel())
            .flat()
            .filter((member) => member.active)
        : memberProfileService.capturedMembers;
      const profiles = memberProfileService.profiles(members);
      let content = page.content;
      if (managed) {
        const rows = await renderView(
          request.server,
          "partials/member-rows.njk",
          { members: profiles },
        );
        content = memberRosterService.replaceRows(content, rows);
      }
      return {
        ...page,
        content: memberRosterService.attachProfileLinks(content, profiles),
        memberProfiles: profiles,
      };
    });
  }

  async photoGallery(request, reply) {
    return reply.redirect("https://westerncircle.smugmug.com/");
  }

  async wcosCouncil(request, reply) {
    return this.renderPage(request, reply, "wcos-council");
  }

  async hallOfHeroes(request, reply) {
    return this.renderPage(request, reply, "hall-of-heroes");
  }
}

export const whoWeAreController = new WhoWeAreController();
