import { PublicPageController } from "./publicPageController.js";
import { memberService } from "../services/memberService.js";
import { memberRosterService } from "../services/memberRosterService.js";
import { renderView } from "../utils/viewEngine.js";

export class WhoWeAreController extends PublicPageController {
  async memberProfiles(request, reply) {
    return this.renderPage(request, reply, "member-profiles", async (page) => {
      // Keep the imported roster until member management is used. Afterwards an
      // empty or inactive roster must stay empty, rather than resurrecting old names.
      if (!(await memberService.isRosterManaged())) return page;
      const membersGrouped = await memberService.getMembersGroupedByLevel();
      const members = Object.values(membersGrouped)
        .flat()
        .filter((member) => member.active);
      const rows = await renderView(
        request.server,
        "partials/member-rows.njk",
        { members },
      );
      return {
        ...page,
        content: memberRosterService.replaceRows(page.content, rows),
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
