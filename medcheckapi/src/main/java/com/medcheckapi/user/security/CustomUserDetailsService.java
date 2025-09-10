package com.medcheckapi.user.security;

import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String cpf) throws UsernameNotFoundException {
        // Defensive trim to avoid lookup failures due to accidental spaces
    final String normalizedCpf = cpf != null ? cpf.replaceAll("\\D", "") : null;
    System.out.println("[CustomUserDetailsService] loadUserByUsername raw='" + cpf + "' normalized='" + normalizedCpf + "' length=" + (normalizedCpf==null?0:normalizedCpf.length()));
    // List stored CPFs for debugging (only in dev)
    userRepository.findAll().forEach(u -> System.out.println("[CustomUserDetailsService] existing cpf='" + u.getCpf() + "' len=" + (u.getCpf()==null?0:u.getCpf().length())));
    User user = userRepository.findByCpf(normalizedCpf)
        .orElseThrow(() -> new UsernameNotFoundException("User not found with cpf: " + normalizedCpf));

    return new org.springframework.security.core.userdetails.User(user.getCpf(), user.getPassword(), new ArrayList<>());
    }

    public UserDetails loadUserById(Long id) {
        User user = userRepository.findById(id).orElseThrow(
            () -> new UsernameNotFoundException("User not found with id : " + id)
        );

        return new org.springframework.security.core.userdetails.User(user.getCpf(), user.getPassword(), new ArrayList<>());
    }
}
