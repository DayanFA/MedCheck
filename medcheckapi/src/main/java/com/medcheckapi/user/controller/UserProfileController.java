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

	public UserProfileController(UserRepository userRepository, DisciplineRepository disciplineRepository) { this.userRepository = userRepository; this.disciplineRepository = disciplineRepository; }

	private User currentUser(org.springframework.security.core.userdetails.User principal) {
		return userRepository.findByCpf(principal.getUsername()).orElseThrow();
	}

	@GetMapping
	public ResponseEntity<?> me(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
		User u = currentUser(principal);
		List<Discipline> preceptorDiscs = disciplineRepository.findByPreceptors_Id(u.getId());
		return ResponseEntity.ok(Map.of(
				"id", u.getId(),
				"name", u.getName(),
				"cpf", u.getCpf(),
				"phone", Optional.ofNullable(u.getPhone()).orElse(""),
				"role", u.getRole().name(),
				"hasAvatar", u.getAvatar() != null && u.getAvatar().length > 0,
				"currentDisciplineId", u.getCurrentDiscipline() == null ? null : u.getCurrentDiscipline().getId(),
				"currentDisciplineName", u.getCurrentDiscipline() == null ? null : u.getCurrentDiscipline().getName(),
				"currentDisciplineCode", u.getCurrentDiscipline() == null ? null : u.getCurrentDiscipline().getCode(),
				"preceptorDisciplines", preceptorDiscs
		));
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
		if (file.getSize() > 2_000_000) return ResponseEntity.badRequest().body(Map.of("error", "Arquivo muito grande (máx 2MB)"));
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
