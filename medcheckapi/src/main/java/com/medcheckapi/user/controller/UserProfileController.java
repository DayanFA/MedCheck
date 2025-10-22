package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.User;
import com.medcheckapi.user.model.Discipline;
import com.medcheckapi.user.repository.DisciplineRepository;
import com.medcheckapi.user.repository.UserRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/users/me")
public class UserProfileController {
	private final UserRepository userRepository;
	private final DisciplineRepository disciplineRepository;
	private final com.medcheckapi.user.repository.CoordinatorEvaluationRepository coordEvalRepo;

	public UserProfileController(UserRepository userRepository, DisciplineRepository disciplineRepository, com.medcheckapi.user.repository.CoordinatorEvaluationRepository coordEvalRepo) { this.userRepository = userRepository; this.disciplineRepository = disciplineRepository; this.coordEvalRepo = coordEvalRepo; }

	private User currentUser(org.springframework.security.core.userdetails.User principal) {
		if (principal == null) return null;
		return userRepository.findByCpf(principal.getUsername()).orElse(null);
	}

	@GetMapping
	public ResponseEntity<?> me(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
		User u = currentUser(principal);
		if (u == null) {
			return ResponseEntity.status(401).body(Map.of("error", "unauthenticated"));
		}
		List<Discipline> preceptorDiscs = disciplineRepository.findByPreceptors_Id(u.getId());
		java.util.Map<String, Object> resp = new java.util.LinkedHashMap<>();
		resp.put("id", u.getId());
		resp.put("name", u.getName());
		resp.put("matricula", Optional.ofNullable(u.getMatricula()).orElse(""));
		resp.put("cpf", u.getCpf());
		resp.put("email", Optional.ofNullable(u.getInstitutionalEmail()).orElse(""));
		resp.put("phone", Optional.ofNullable(u.getPhone()).orElse(""));
		resp.put("role", u.getRole().name());
		resp.put("hasAvatar", u.getAvatar() != null && u.getAvatar().length > 0);
		resp.put("currentDisciplineId", u.getCurrentDiscipline() == null ? null : u.getCurrentDiscipline().getId());
		resp.put("currentDisciplineName", u.getCurrentDiscipline() == null ? null : u.getCurrentDiscipline().getName());
		resp.put("currentDisciplineCode", u.getCurrentDiscipline() == null ? null : u.getCurrentDiscipline().getCode());
		resp.put("preceptorDisciplines", preceptorDiscs);
		return ResponseEntity.ok(resp);
	}

	// Final evaluation visible to the logged-in user (student), for a given discipline or current one
	@GetMapping("/final-evaluation")
	public ResponseEntity<?> myFinalEvaluation(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
											   @RequestParam(value = "disciplineId", required = false) Long disciplineId) {
		User me = currentUser(principal);
		if (me == null) return ResponseEntity.status(401).body(Map.of("error","unauthenticated"));
		Discipline disc = null;
		if (disciplineId != null) {
			disc = disciplineRepository.findById(disciplineId).orElse(null);
		} else if (me.getCurrentDiscipline() != null) {
			disc = me.getCurrentDiscipline();
		}
		if (disc == null) {
			return ResponseEntity.ok(Map.of("found", false));
		}
		var opt = coordEvalRepo.findFirstByAlunoAndDiscipline(me, disc);
		if (opt.isEmpty()) return ResponseEntity.ok(Map.of("found", false));
		var ev = opt.get();
		// Map.of não aceita valores nulos; construir mapa mutável para permitir comment null
		java.util.Map<String, Object> resp = new java.util.LinkedHashMap<>();
		resp.put("found", true);
		resp.put("disciplineId", disc.getId());
		resp.put("score", ev.getScore());
		resp.put("comment", ev.getComment()); // pode ser null
		return ResponseEntity.ok(resp);
	}

	@PutMapping
	public ResponseEntity<?> update(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
									@RequestBody Map<String,String> body) {
		User u = currentUser(principal);
		if (body.containsKey("phone")) {
			String phone = body.get("phone");
			if (phone == null || phone.trim().isEmpty()) {
				return ResponseEntity.badRequest().body(Map.of("error", "Telefone não pode ser vazio"));
			}
			u.setPhone(phone);
		}
		userRepository.save(u);
		return ResponseEntity.ok(Map.of("ok", true));
	}

	@GetMapping("/disciplines")
	public ResponseEntity<?> listAvailableDisciplines(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
		// Para o aluno escolher; aqui listamos todas as disciplinas que têm ao menos um preceptor vinculado
		return ResponseEntity.ok(disciplineRepository.findAll());
	}

	@PutMapping("/discipline")
	public ResponseEntity<?> setCurrentDiscipline(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
												  @RequestBody Map<String, Long> body) {
		User u = currentUser(principal);
		Long id = body.get("disciplineId");
		if (id == null) { u.setCurrentDiscipline(null); userRepository.save(u); return ResponseEntity.ok(Map.of("ok", true)); }
		Discipline d = disciplineRepository.findById(id).orElseThrow();
		u.setCurrentDiscipline(d);
		userRepository.save(u);
		return ResponseEntity.ok(Map.of(
			"ok", true,
			"currentDisciplineId", d.getId(),
			"currentDisciplineName", d.getName(),
			"currentDisciplineCode", d.getCode()
		));
	}

	@GetMapping("/photo")
	@Transactional(readOnly = true)
	public ResponseEntity<?> getPhoto(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
		User u = currentUser(principal);
		if (u.getAvatar() == null || u.getAvatar().length == 0) {
			return ResponseEntity.notFound().build();
		}
		return ResponseEntity.ok()
				.header(HttpHeaders.CACHE_CONTROL, "no-store")
				.contentType(u.getAvatarContentType() != null ? MediaType.parseMediaType(u.getAvatarContentType()) : MediaType.IMAGE_JPEG)
				.body(u.getAvatar());
	}

	@PostMapping(value = "/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<?> uploadPhoto(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
										 @RequestParam("file") MultipartFile file) throws Exception {
		if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Arquivo vazio"));
	if (file.getSize() > 5_000_000) return ResponseEntity.badRequest().body(Map.of("error", "Arquivo muito grande (máx 5MB)"));
		String ct = Optional.ofNullable(file.getContentType()).orElse("image/jpeg");
		if (!ct.startsWith("image/")) return ResponseEntity.badRequest().body(Map.of("error", "Tipo não suportado"));
		User u = currentUser(principal);
		u.setAvatar(file.getBytes());
		u.setAvatarContentType(ct);
		userRepository.save(u);
		return ResponseEntity.ok(Map.of("ok", true));
	}

	@DeleteMapping("/photo")
	public ResponseEntity<?> deletePhoto(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
		User u = currentUser(principal);
		u.setAvatar(null);
		u.setAvatarContentType(null);
		userRepository.save(u);
		return ResponseEntity.ok(Map.of("ok", true));
	}
}
